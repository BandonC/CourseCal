import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM for the Google refresh token at rest (ADR-006, ADR-008). The key
// is TOKEN_ENCRYPTION_KEY: 64 hex chars → 32 bytes (validated in lib/env). A
// fresh 12-byte IV per encryption is the GCM standard; the 16-byte auth tag
// detects tampering. Stored as `iv:tag:ciphertext`, each base64.
//
// Never log a token or include one in an error message (root CLAUDE.md). The
// failure paths here throw on malformed/altered input only — never echo input.

const KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
const IV_BYTES = 12;

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("malformed encrypted token");
  }
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
