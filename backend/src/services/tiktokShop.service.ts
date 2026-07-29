import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionConfigured,
} from "../utils/secretEncryption";

const DEFAULT_TOKEN_URL = "https://auth.tiktok-shops.com/api/v2/token/get";
const DEFAULT_REFRESH_URL =
  "https://auth.tiktok-shops.com/api/v2/token/refresh";
const REFRESH_BUFFER_MS = 10 * 60 * 1000;
const STATE_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

export type TikTokCallbackFailureCategory =
  | "tiktok_callback_missing_code"
  | "tiktok_callback_missing_state"
  | "tiktok_callback_invalid_state"
  | "tiktok_callback_expired_state"
  | "tiktok_callback_provider_error"
  | "tiktok_callback_token_exchange_failed"
  | "tiktok_callback_storage_failed";

export class TikTokCallbackError extends Error {
  constructor(public readonly category: TikTokCallbackFailureCategory) {
    super(category);
    this.name = "TikTokCallbackError";
  }
}

const tokenDataSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  access_token_expire_in: z.coerce.number().int().positive(),
  refresh_token_expire_in: z.coerce.number().int().positive(),
  open_id: z.string().min(1),
});

const tokenResponseSchema = z.object({
  code: z.coerce.number().int(),
  message: z.string().optional(),
  data: tokenDataSchema.optional(),
});

type TikTokConfig = {
  appKey: string;
  appSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl: string;
};

type TokenBundle = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

const requiredEnvironmentVariables = [
  "TIKTOK_SHOP_APP_KEY",
  "TIKTOK_SHOP_APP_SECRET",
  "TIKTOK_SHOP_AUTHORIZATION_URL",
] as const;

const requireHttpsUrl = (value: string, variableName: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error();
    }
    return url;
  } catch {
    throw new AppError(`${variableName} must be a valid HTTPS URL`, 500);
  }
};

const getTikTokConfig = (): TikTokConfig => {
  const missingVariables = requiredEnvironmentVariables.filter(
    (name) => !process.env[name]
  );

  if (missingVariables.length > 0) {
    throw new AppError(
      `TikTok Shop is not configured. Missing: ${missingVariables.join(", ")}`,
      500
    );
  }

  const authorizationUrl = requireHttpsUrl(
    process.env.TIKTOK_SHOP_AUTHORIZATION_URL as string,
    "TIKTOK_SHOP_AUTHORIZATION_URL"
  ).toString();
  const tokenUrl = requireHttpsUrl(
    process.env.TIKTOK_SHOP_TOKEN_URL || DEFAULT_TOKEN_URL,
    "TIKTOK_SHOP_TOKEN_URL"
  ).toString();
  const refreshUrl = requireHttpsUrl(
    process.env.TIKTOK_SHOP_REFRESH_URL || DEFAULT_REFRESH_URL,
    "TIKTOK_SHOP_REFRESH_URL"
  ).toString();

  return {
    appKey: process.env.TIKTOK_SHOP_APP_KEY as string,
    appSecret: process.env.TIKTOK_SHOP_APP_SECRET as string,
    authorizationUrl,
    tokenUrl,
    refreshUrl,
  };
};

const isTikTokConfigured = () => {
  try {
    getTikTokConfig();
    return isSecretEncryptionConfigured();
  } catch {
    return false;
  }
};

const unixTimestampToDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("TikTok Shop returned invalid token expiry data", 502);
  }

  return date;
};

const parseTokenResponse = async (response: Response): Promise<TokenBundle> => {
  let responseData: unknown;

  try {
    responseData = await response.json();
  } catch {
    throw new AppError("TikTok Shop returned an invalid token response", 502);
  }

  const parsed = tokenResponseSchema.safeParse(responseData);

  if (
    !response.ok ||
    !parsed.success ||
    parsed.data.code !== 0 ||
    !parsed.data.data
  ) {
    throw new AppError("TikTok Shop rejected the token request", 502);
  }

  return {
    merchantId: parsed.data.data.open_id,
    accessToken: parsed.data.data.access_token,
    refreshToken: parsed.data.data.refresh_token,
    accessTokenExpiresAt: unixTimestampToDate(
      parsed.data.data.access_token_expire_in
    ),
    refreshTokenExpiresAt: unixTimestampToDate(
      parsed.data.data.refresh_token_expire_in
    ),
  };
};

const requestTokenBundle = async (
  config: TikTokConfig,
  grant:
    | { grantType: "authorized_code"; authorizationCode: string }
    | { grantType: "refresh_token"; refreshToken: string }
) => {
  const endpoint =
    grant.grantType === "authorized_code" ? config.tokenUrl : config.refreshUrl;
  const url = new URL(endpoint);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("app_secret", config.appSecret);
  url.searchParams.set("grant_type", grant.grantType);

  if (grant.grantType === "authorized_code") {
    url.searchParams.set("auth_code", grant.authorizationCode);
  } else {
    url.searchParams.set("refresh_token", grant.refreshToken);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Unable to reach TikTok Shop token service", 502);
  }

  return parseTokenResponse(response);
};

const stateHash = (state: string) =>
  createHash("sha256").update(state, "utf8").digest("hex");

const validateAndConsumeState = async (state: string | undefined) => {
  if (!state) {
    throw new TikTokCallbackError("tiktok_callback_missing_state");
  }

  try {
    const now = new Date();
    const hashedState = stateHash(state);

    await prisma.$transaction(async (transaction) => {
      const storedState = await transaction.tikTokOAuthState.findUnique({
        where: { stateHash: hashedState },
        select: { expiresAt: true, usedAt: true },
      });

      if (!storedState || storedState.usedAt) {
        throw new TikTokCallbackError("tiktok_callback_invalid_state");
      }

      if (storedState.expiresAt <= now) {
        throw new TikTokCallbackError("tiktok_callback_expired_state");
      }

      const consumed = await transaction.tikTokOAuthState.updateMany({
        where: {
          stateHash: hashedState,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw new TikTokCallbackError("tiktok_callback_invalid_state");
      }
    });
  } catch (error) {
    if (error instanceof TikTokCallbackError) {
      throw error;
    }
    throw new TikTokCallbackError("tiktok_callback_storage_failed");
  }
};

const toSafeConnection = (connection: {
  merchantId: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}) => ({
  connected: true as const,
  merchantId: connection.merchantId,
  accessTokenExpiresAt: connection.accessTokenExpiresAt,
  refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
});

const storeTokenBundle = async (tokenBundle: TokenBundle) => {
  const encryptedAccessToken = encryptSecret(tokenBundle.accessToken);
  const encryptedRefreshToken = encryptSecret(tokenBundle.refreshToken);

  return prisma.tikTokConnection.upsert({
    where: { merchantId: tokenBundle.merchantId },
    create: {
      merchantId: tokenBundle.merchantId,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt,
    },
    update: {
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt,
      connectedAt: new Date(),
      refreshedAt: null,
    },
  });
};

export const createTikTokShopAuthorization = async () => {
  const config = getTikTokConfig();
  const state = randomBytes(32).toString("base64url");

  try {
    await prisma.tikTokOAuthState.create({
      data: {
        stateHash: stateHash(state),
        expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
      },
    });
  } catch {
    throw new AppError("TikTok Shop authorization could not be started", 500);
  }

  const authorizationUrl = new URL(config.authorizationUrl);
  authorizationUrl.searchParams.set("state", state);

  return { authorizationUrl: authorizationUrl.toString() };
};

export const completeTikTokShopAuthorization = async ({
  state,
  code,
  tiktokError,
}: {
  state: string | undefined;
  code: string | undefined;
  tiktokError: string | undefined;
}) => {
  await validateAndConsumeState(state);

  if (tiktokError) {
    throw new TikTokCallbackError("tiktok_callback_provider_error");
  }

  if (!code || code === "null") {
    throw new TikTokCallbackError("tiktok_callback_missing_code");
  }

  let tokenBundle: TokenBundle;

  try {
    const config = getTikTokConfig();
    tokenBundle = await requestTokenBundle(config, {
      grantType: "authorized_code",
      authorizationCode: code,
    });
  } catch {
    throw new TikTokCallbackError(
      "tiktok_callback_token_exchange_failed"
    );
  }

  try {
    await storeTokenBundle(tokenBundle);
  } catch {
    throw new TikTokCallbackError("tiktok_callback_storage_failed");
  }
};

export const refreshTikTokShopToken = async () => {
  const config = getTikTokConfig();
  const connections = await prisma.tikTokConnection.findMany({
    orderBy: { connectedAt: "desc" },
    take: 2,
  });

  if (connections.length === 0) {
    throw new AppError("TikTok Shop is not connected", 404);
  }
  if (connections.length > 1) {
    throw new AppError("Specify which TikTok Shop connection to refresh", 409);
  }

  const connection = connections[0];
  if (connection.refreshTokenExpiresAt <= new Date()) {
    throw new AppError(
      "TikTok Shop refresh token has expired. Reconnect required",
      409
    );
  }

  const tokenBundle = await requestTokenBundle(config, {
    grantType: "refresh_token",
    refreshToken: decryptSecret(connection.encryptedRefreshToken),
  });
  const updatedConnection = await prisma.tikTokConnection.update({
    where: { id: connection.id },
    data: {
      merchantId: tokenBundle.merchantId,
      encryptedAccessToken: encryptSecret(tokenBundle.accessToken),
      encryptedRefreshToken: encryptSecret(tokenBundle.refreshToken),
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt,
      refreshedAt: new Date(),
    },
  });

  return toSafeConnection(updatedConnection);
};

export const getValidTikTokAccessToken = async () => {
  const connections = await prisma.tikTokConnection.findMany({
    orderBy: { connectedAt: "desc" },
    take: 2,
  });

  if (connections.length !== 1) {
    throw new AppError("A single TikTok Shop connection is required", 409);
  }

  if (
    connections[0].accessTokenExpiresAt.getTime() <=
    Date.now() + REFRESH_BUFFER_MS
  ) {
    await refreshTikTokShopToken();
    const refreshed = await prisma.tikTokConnection.findUnique({
      where: { id: connections[0].id },
    });
    if (!refreshed) {
      throw new AppError("TikTok Shop connection could not be loaded", 500);
    }
    return decryptSecret(refreshed.encryptedAccessToken);
  }

  return decryptSecret(connections[0].encryptedAccessToken);
};

export const getTikTokConnectionStatus = async () => {
  const configured = isTikTokConfigured();
  const connections = await prisma.tikTokConnection.findMany({
    select: {
      merchantId: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
    },
    orderBy: { connectedAt: "desc" },
  });

  return {
    configured,
    connected: connections.length > 0,
    connectionCount: connections.length,
    connections: connections.map((connection) => ({
      ...toSafeConnection(connection),
      needsRefresh:
        connection.accessTokenExpiresAt.getTime() <=
        Date.now() + REFRESH_BUFFER_MS,
    })),
  };
};
