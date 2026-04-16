/**
 * CryptoService — AES-256-GCM encryption/decryption for PII fields
 *
 * All PII (email in legacy unencrypted form, phone, address) must be passed
 * through this service before persisting to PostgreSQL. The encryption key
 * is loaded from ENCRYPTION_KEY env var (32-byte hex string).
 *
 * @module CryptoService
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "shipmind-pii-salt"; // Static salt for key derivation — use per-field salt in production

/**
 * Derive a 32-byte key from the ENCRYPTION_KEY env var
 */
function getDerivedKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("ENCRYPTION_KEY env var is required for PII encryption");
  }
  return scryptSync(rawKey, SALT, 32);
}

/**
 * Encrypt a plain-text PII string
 *
 * Output format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 *
 * @param plaintext - The PII value to encrypt
 * @returns Encrypted string safe to store in PostgreSQL
 */
export function encryptPII(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a PII string previously encrypted with encryptPII
 *
 * @param ciphertext - The `iv:authTag:data` string from the database
 * @returns Original plain-text PII value
 */
export function decryptPII(ciphertext: string): string {
  const key = getDerivedKey();
  const [ivHex, authTagHex, dataHex] = ciphertext.split(":");

  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Check whether a string is already encrypted (safe to call multiple times)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === 32;
}
