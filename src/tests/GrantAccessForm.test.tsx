import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateAESKey,
  getSaleEncryptionKey,
  storeSaleEncryptionKey,
  wrapAESKey,
  getPublicKeyForAddress,
} from "../lib/crypto";

describe("GrantAccessForm & Crypto Audit Key Wrapping (#150)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AES Key Generation and Storage", () => {
    it("should generate a valid CryptoKey", async () => {
      const key = await generateAESKey();
      expect(key).toBeDefined();
    });

    it("should return the same key for the same saleId", async () => {
      const saleId = "sale-101";
      const key1 = await getSaleEncryptionKey(saleId);
      const key2 = await getSaleEncryptionKey(saleId);
      expect(key1).toBe(key2);
    });

    it("should allow pre-storing an encryption key for a saleId", async () => {
      const mockCustomKey = { type: "secret", algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;
      storeSaleEncryptionKey("sale-999", mockCustomKey);
      const retrieved = await getSaleEncryptionKey("sale-999");
      expect(retrieved).toBe(mockCustomKey);
    });
  });

  describe("Key Wrapping and Public Key Lookup", () => {
    it("should derive public key for wallet address", async () => {
      const addr = "GAUDITOR1234567890TESTNET";
      const pubKey = await getPublicKeyForAddress(addr);
      expect(pubKey).toContain(addr);
    });

    it("should wrap an AES key using the auditor public key", async () => {
      const key = await generateAESKey();
      const auditorPubKey = "MOCK_PUBLIC_KEY_FOR_GAUDITOR123";
      const wrapped = await wrapAESKey(key, auditorPubKey);

      expect(wrapped).toBeDefined();
      expect(wrapped).toContain(auditorPubKey);
      expect(wrapped.startsWith("WRAPPED_KEY_")).toBe(true);
    });
  });
});
