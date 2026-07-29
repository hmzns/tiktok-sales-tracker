import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { AppError } from "./AppError";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCODED_VERSION = "v1";

const getEncryptionKey = () => {
  const encodedKey = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new AppError("TikTok token encryption is not configured", 500);
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new AppError(
      "TIKTOK_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
      500
    );
  }

  return key;
};

export const isSecretEncryptionConfigured = () => {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
};

export const encryptSecret = (plaintext: string) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCODED_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

export const decryptSecret = (encodedValue: string) => {
  const [version, encodedIv, encodedAuthTag, encodedCiphertext, extraPart] =
    encodedValue.split(".");

  if (
    version !== ENCODED_VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedCiphertext ||
    extraPart
  ) {
    throw new AppError("Stored TikTok token is invalid", 500);
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const authTag = Buffer.from(encodedAuthTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new AppError("Stored TikTok token is invalid", 500);
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError("Stored TikTok token could not be decrypted", 500);
  }
};
