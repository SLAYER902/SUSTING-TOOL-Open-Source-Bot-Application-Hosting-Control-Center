import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const value = process.env.ENCRYPTION_KEY;
  if (!value) throw new Error("ENCRYPTION_KEY must be configured before storing secrets.");
  const parsed = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (parsed.length !== 32) throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (base64 or 64-char hex).");
  return parsed;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value: string): string {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL;
  if (origin && appUrl && new URL(origin).origin !== new URL(appUrl).origin) {
    throw new Error("Cross-site request rejected.");
  }
}

export function validatePassword(password: string): string | null {
  if (password.length < 14) return "Use at least 14 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return "Use upper-case, lower-case, and numeric characters.";
  if (/^(password|admin|123456|qwerty)/i.test(password)) return "Choose a less predictable password.";
  return null;
}
