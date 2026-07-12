import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, validatePassword } from "../apps/web/lib/security";

const before = process.env.ENCRYPTION_KEY;
afterEach(() => { process.env.ENCRYPTION_KEY = before; });

describe("secret encryption", () => {
  it("round-trips AES-GCM values and produces non-plaintext output", () => {
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const encrypted = encryptSecret("not-for-the-api");
    expect(encrypted).not.toContain("not-for-the-api");
    expect(decryptSecret(encrypted)).toBe("not-for-the-api");
  });
  it("rejects weak initial passwords", () => {
    expect(validatePassword("password123")).toBeTruthy();
    expect(validatePassword("AdequatelyLongPassword9")).toBeNull();
  });
});
