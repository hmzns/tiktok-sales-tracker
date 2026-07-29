import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionConfigured,
} from "../utils/secretEncryption";
import { generateTikTokShopSignature } from "../utils/tiktokShopSignature";

const DEFAULT_TOKEN_URL = "https://auth.tiktok-shops.com/api/v2/token/get";
const DEFAULT_REFRESH_URL =
  "https://auth.tiktok-shops.com/api/v2/token/refresh";
const DEFAULT_API_BASE_URL = "https://open-api.tiktokglobalshop.com";
const AUTHORIZED_SHOPS_PATH = "/authorization/202309/shops";
const REFRESH_BUFFER_MS = 10 * 60 * 1000;
const STATE_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;
const API_REQUEST_TIMEOUT_MS = 15_000;

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

const authorizedShopSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  cipher: z.string().trim().min(1),
  region: z.string().trim().min(1),
});

const authorizedShopsResponseSchema = z.object({
  code: z.coerce.number().int(),
  message: z.string().optional(),
  data: z
    .object({
      shops: z.array(authorizedShopSchema),
    })
    .optional(),
});

type TikTokConfig = {
  appKey: string;
  appSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl: string;
  apiBaseUrl: string;
};

type TokenBundle = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

export type AuthorizedTikTokShop = z.infer<typeof authorizedShopSchema>;

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
  const apiBaseUrl = requireHttpsUrl(
    process.env.TIKTOK_SHOP_API_BASE_URL || DEFAULT_API_BASE_URL,
    "TIKTOK_SHOP_API_BASE_URL"
  ).toString();

  return {
    appKey: process.env.TIKTOK_SHOP_APP_KEY as string,
    appSecret: process.env.TIKTOK_SHOP_APP_SECRET as string,
    authorizationUrl,
    tokenUrl,
    refreshUrl,
    apiBaseUrl,
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
  shopId: string | null;
  shopCode: string | null;
  shopName: string | null;
  shopCipher: string | null;
  shopRegion: string | null;
}) => ({
  connected: true as const,
  merchantId: connection.merchantId,
  accessTokenExpiresAt: connection.accessTokenExpiresAt,
  refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
  shopConfigured: Boolean(
    connection.shopId &&
      connection.shopCode &&
      connection.shopName &&
      connection.shopCipher &&
      connection.shopRegion
  ),
  shopId: connection.shopId,
  shopCode: connection.shopCode,
  shopName: connection.shopName,
  shopRegion: connection.shopRegion,
  hasShopCipher: Boolean(connection.shopCipher),
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

export const getAuthorizedShops = async (): Promise<
  AuthorizedTikTokShop[]
> => {
  const config = getTikTokConfig();
  const accessToken = await getValidTikTokAccessToken();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const queryParams = {
    app_key: config.appKey,
    timestamp,
  };
  const sign = generateTikTokShopSignature({
    appSecret: config.appSecret,
    method: "GET",
    path: AUTHORIZED_SHOPS_PATH,
    queryParams,
  });
  const url = new URL(AUTHORIZED_SHOPS_PATH, config.apiBaseUrl);

  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", sign);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Unable to reach TikTok Shop API", 502);
  }

  let responseData: unknown;

  try {
    responseData = await response.json();
  } catch {
    throw new AppError(
      "TikTok Shop returned an invalid authorized shops response",
      502
    );
  }

  const parsed = authorizedShopsResponseSchema.safeParse(responseData);

  if (!parsed.success) {
    throw new AppError(
      "TikTok Shop returned an invalid authorized shops response",
      502
    );
  }

  if (!response.ok || parsed.data.code !== 0 || !parsed.data.data) {
    throw new AppError(
      "TikTok Shop rejected the authorized shops request",
      502
    );
  }

  return parsed.data.data.shops;
};

export const syncAuthorizedTikTokShop = async () => {
  const shops = await getAuthorizedShops();

  if (shops.length === 0) {
    throw new AppError(
      "TikTok Shop returned no usable authorized shops",
      409
    );
  }

  if (shops.length > 1) {
    throw new AppError(
      "Multiple authorized TikTok Shops were returned; this application requires exactly one shop",
      409
    );
  }

  const connections = await prisma.tikTokConnection.findMany({
    select: { id: true },
    orderBy: { connectedAt: "desc" },
    take: 2,
  });

  if (connections.length !== 1) {
    throw new AppError("A single TikTok Shop connection is required", 409);
  }

  const shop = shops[0];

  try {
    await prisma.tikTokConnection.update({
      where: { id: connections[0].id },
      data: {
        shopId: shop.id,
        shopCode: shop.code,
        shopName: shop.name,
        shopCipher: shop.cipher,
        shopRegion: shop.region,
      },
    });
  } catch {
    throw new AppError("TikTok Shop metadata could not be saved", 500);
  }

  return {
    connected: true as const,
    shopId: shop.id,
    shopCode: shop.code,
    shopName: shop.name,
    shopRegion: shop.region,
    hasShopCipher: true,
  };
};

export const getTikTokConnectionStatus = async () => {
  const configured = isTikTokConfigured();
  const connections = await prisma.tikTokConnection.findMany({
    select: {
      merchantId: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      shopId: true,
      shopCode: true,
      shopName: true,
      shopCipher: true,
      shopRegion: true,
    },
    orderBy: { connectedAt: "desc" },
  });

  const safeConnections = connections.map((connection) => ({
    ...toSafeConnection(connection),
    needsRefresh:
      connection.accessTokenExpiresAt.getTime() <=
      Date.now() + REFRESH_BUFFER_MS,
  }));
  const singleConnection =
    safeConnections.length === 1 ? safeConnections[0] : undefined;

  return {
    configured,
    connected: connections.length > 0,
    shopConfigured: singleConnection?.shopConfigured ?? false,
    shopId: singleConnection?.shopId ?? null,
    shopCode: singleConnection?.shopCode ?? null,
    shopName: singleConnection?.shopName ?? null,
    shopRegion: singleConnection?.shopRegion ?? null,
    hasShopCipher: singleConnection?.hasShopCipher ?? false,
    connectionCount: connections.length,
    connections: safeConnections,
  };
};
