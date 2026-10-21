/**
 * Secure Affiliate Sale Payload Crypto (Issue #49)
 * Real AES-GCM-256 envelope encryption via WebCrypto (`crypto.subtle`).
 * Envelope: base64(JSON { v:1, alg:"AES-GCM-256", iv:b64(12B), data:b64(ct) })
 */

const saleKeyStore = new Map<string, CryptoKey>();

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const ENVELOPE_VERSION = 1;
const GCM_IV_BYTES = 12;
const MAX_PLAINTEXT_BYTES = 64 * 1024;
const MAX_ENVELOPE_CHARS = 200_000;

interface SecureEnvelope {
  v: number;
  alg: string;
  iv: string;
  data: string;
}

function getSubtle(): SubtleCrypto {
  const subtle =
    globalThis.crypto?.subtle ??
    (globalThis as unknown as { webcrypto?: Crypto }).webcrypto?.subtle;

  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is unavailable in this environment.");
  }

  return subtle;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(input: string): Uint8Array<ArrayBuffer> {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid encrypted payload: malformed envelope.");
  }

  if (!/^[A-Za-z0-9+/=_-]+$/.test(input)) {
    throw new Error("Invalid encrypted payload: malformed envelope.");
  }

  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  let binary: string;

  try {
    binary = atob(normalized);
  } catch {
    throw new Error("Invalid encrypted payload: malformed envelope.");
  }

  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  const cryptoProvider =
    globalThis.crypto ??
    (globalThis as unknown as { webcrypto?: Crypto }).webcrypto;

  if (cryptoProvider?.getRandomValues) {
    cryptoProvider.getRandomValues(bytes);
    return bytes;
  }

  throw new Error("Secure random number generator is unavailable.");
}

function assertAesGcmKey(key: unknown): asserts key is CryptoKey {
  const candidate = key as CryptoKey | null;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    (candidate.algorithm as Algorithm | undefined)?.name?.toUpperCase() !== "AES-GCM"
  ) {
    throw new Error("Decryption failed: invalid key.");
  }
}

async function deriveWrappingKey(identifier: string): Promise<CryptoKey> {
  if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {