const saleKeyStore = new Map<string, CryptoKey>();

export async function generateAESKey(): Promise<CryptoKey> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      return await crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
      );
    } catch (e) {
      console.warn("SubtleCrypto generateKey failed, returning fallback key", e);
    }
  }
  return {} as CryptoKey;
}

/**
 * Retrieves or generates an AES encryption key for a given saleId.
 */
export async function getSaleEncryptionKey(saleId: string): Promise<CryptoKey> {
  const existing = saleKeyStore.get(saleId);
  if (existing) {
    return existing;
  }
  const newKey = await generateAESKey();
  saleKeyStore.set(saleId, newKey);
  return newKey;
}

export function storeSaleEncryptionKey(saleId: string, key: CryptoKey): void {
  saleKeyStore.set(saleId, key);
}

export async function encryptPayload(payload: object, _aesKey: CryptoKey): Promise<string> {
  // Placeholder
  console.log("Stub: Encrypting payload...", payload);
  return "STUB_ENCRYPTED_PAYLOAD";
}

export async function wrapAESKey(_aesKey: CryptoKey, publicKey: string): Promise<string> {
  console.log("Wrapping AES key for public key:", publicKey);
  return `WRAPPED_KEY_${publicKey}`;
}

export async function unwrapAESKey(_wrappedKey: string, _privateKey: string): Promise<CryptoKey> {
  // Placeholder
  console.log("Stub: Unwrapping AES key...");
  return {} as CryptoKey;
}

export async function decryptPayload(
  _encryptedPayload: string,
  _aesKey: CryptoKey,
): Promise<object> {
  // Placeholder
  console.log("Stub: Decrypting payload...");
  return { decrypted_message: "This is stub data" };
}

// Helper to get a "mock" public key from a wallet address
export async function getPublicKeyForAddress(address: string): Promise<string> {
  // In a real app, this might come from a different contract,
  // a signature-based lookup, or MetaMask's encryption methods.
  console.log("Stub: Fetching public key for address:", address);
  return `MOCK_PUBLIC_KEY_FOR_${address}`;
}
