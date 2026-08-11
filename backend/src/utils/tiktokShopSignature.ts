import { createHmac } from "node:crypto";

export type TikTokShopQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type GenerateTikTokShopSignatureInput = {
  appSecret: string;
  method: string;
  path: string;
  queryParams: Record<string, TikTokShopQueryValue>;
  body?: unknown;
  contentType?: string;
};

const excludedQueryParameters = new Set(["access_token", "sign"]);

const serializeBody = (body: unknown) => {
  if (typeof body === "string") {
    return body;
  }

  const serialized = JSON.stringify(body);
  if (serialized === undefined) {
    throw new Error("TikTok Shop request body is not JSON serializable");
  }

  return serialized;
};

export const generateTikTokShopSignature = ({
  appSecret,
  method,
  path,
  queryParams,
  body,
  contentType = "application/json",
}: GenerateTikTokShopSignatureInput) => {
  if (!appSecret) {
    throw new Error("TikTok Shop app secret is required for signing");
  }
  if (!method.trim()) {
    throw new Error("TikTok Shop request method is required for signing");
  }
  if (!path.startsWith("/")) {
    throw new Error("TikTok Shop request path must start with a slash");
  }

  const parameterString = Object.entries(queryParams)
    .filter(
      ([key, value]) =>
        !excludedQueryParameters.has(key) &&
        value !== undefined &&
        value !== null
    )
    .sort(([leftKey], [rightKey]) =>
      leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
    )
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");

  let payload = `${path}${parameterString}`;
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");

  if (body !== undefined && body !== null && !isMultipart) {
    payload += serializeBody(body);
  }

  const signingInput = `${appSecret}${payload}${appSecret}`;

  return createHmac("sha256", appSecret)
    .update(signingInput, "utf8")
    .digest("hex");
};
