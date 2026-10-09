/**
 * @file    src/services/crypto/crypto-vault.ts
 * @version 1.0.0
 * @description
 *   Web Crypto API (SubtleCrypto AES-256-GCM) Local Cryptographic Vault.
 *   Conforms to PRD-017 Section 3.2:
 *   - PBKDF2 (100,000 iterations SHA-256) master key derivation.
 *   - AES-GCM 256-bit authenticated symmetric encryption with 128-bit MAC.
 *   - Ephemeral in-memory key caching with automatic TTL eviction and explicit cache clearing.
 *   - Zero third-party runtime dependencies; fully cross-compatible with browser and Node.js environments.
 */

export interface EncryptedVaultPayload {
  version: 1;
  saltHex: string;       // PBKDF2 salt (16 bytes, 32 hex chars)
  ivHex: string;         // AES-GCM initialization vector (12 bytes, 24 hex chars)
  ciphertextHex: string; // Ciphertext bytes including 128-bit authentication tag
  authTagLength: 128;
}

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTE_LENGTH = 16;
export const IV_BYTE_LENGTH = 12;
export const KEY_LENGTH_BITS = 256;
export const AUTH_TAG_LENGTH_BITS = 128;

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory key cache for ephemeral master key protection
interface CachedKeyEntry {
  key: CryptoKey;
  expiresAt: number;
}
const masterKeyCache = new Map<string, CachedKeyEntry>();
let cacheTtlMs = DEFAULT_CACHE_TTL_MS;

/**
 * Returns SubtleCrypto instance across browser and Node.js global scopes.
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  throw new Error('Web Crypto API (SubtleCrypto) is not supported in the current environment.');
}

/**
 * Fills a typed array with cryptographically strong pseudo-random values.
 */
function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  throw new Error('Web Crypto API (getRandomValues) is not supported in the current environment.');
}

/**
 * Encodes Uint8Array bytes to a lowercase hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    hex += b < 16 ? '0' + b.toString(16) : b.toString(16);
  }
  return hex;
}

/**
 * Decodes a hexadecimal string to Uint8Array bytes.
 * Throws an Error if the hex string is malformed.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string') {
    throw new Error('Hex value must be a string.');
  }
  const cleanHex = hex.trim();
  if (cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error(`Invalid hexadecimal string: "${hex}"`);
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Validates whether an unknown value conforms to the EncryptedVaultPayload contract.
 */
export function isVaultPayload(value: unknown): value is EncryptedVaultPayload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    p['version'] === 1 &&
    p['authTagLength'] === 128 &&
    typeof p['saltHex'] === 'string' &&
    p['saltHex'].length >= 32 &&
    typeof p['ivHex'] === 'string' &&
    p['ivHex'].length === 24 &&
    typeof p['ciphertextHex'] === 'string' &&
    /^[0-9a-fA-F]+$/.test(p['saltHex']) &&
    /^[0-9a-fA-F]+$/.test(p['ivHex']) &&
    (p['ciphertextHex'] === '' || /^[0-9a-fA-F]+$/.test(p['ciphertextHex']))
  );
}

/**
 * Clears all cached in-memory derived CryptoKeys.
 */
export function clearMasterKeyCache(): void {
  masterKeyCache.clear();
}

/**
 * Sets the time-to-live (in milliseconds) for in-memory derived CryptoKeys.
 */
export function setMasterKeyCacheTtl(ttlMs: number): void {
  cacheTtlMs = Math.max(0, ttlMs);
}

/**
 * Returns diagnostic statistics for the in-memory derived master key cache.
 */
export function getMasterKeyCacheStats(): { size: number } {
  // Purge expired keys
  const now = Date.now();
  for (const [key, entry] of masterKeyCache.entries()) {
    if (entry.expiresAt <= now) {
      masterKeyCache.delete(key);
    }
  }
  return { size: masterKeyCache.size };
}

/**
 * Generates a fast SHA-256 digest hex of the passphrase to construct safe cache keys
 * without storing plaintext passphrases in memory keys.
 */
async function computePassphraseHash(passphrase: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const digestBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
  return bytesToHex(new Uint8Array(digestBuffer));
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user passphrase and a PBKDF2 salt.
 *
 * @param passphrase - Master passphrase string (must not be empty)
 * @param salt - 16-byte random salt
 * @param options - Optional cache control { useCache?: boolean }
 */
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
  options: { useCache?: boolean } = {},
): Promise<CryptoKey> {
  if (typeof passphrase !== 'string' || passphrase.trim().length === 0) {
    throw new Error('Passphrase must be a non-empty string.');
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength < SALT_BYTE_LENGTH) {
    throw new Error(`Salt must be a Uint8Array of at least ${SALT_BYTE_LENGTH} bytes.`);
  }

  const subtle = getSubtleCrypto();
  const useCache = options.useCache !== false && cacheTtlMs > 0;

  let cacheKey = '';
  if (useCache) {
    const saltHex = bytesToHex(salt);
    const passHash = await computePassphraseHash(passphrase);
    cacheKey = `${saltHex}:${passHash}`;

    const cached = masterKeyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }
  }

  // 1. Import base raw passphrase key for PBKDF2 derivation
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  // 2. Derive 256-bit AES-GCM key with 100,000 SHA-256 iterations
  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false, // Non-extractable for memory protection
    ['encrypt', 'decrypt'],
  );

  if (useCache && cacheKey) {
    masterKeyCache.set(cacheKey, {
      key: derivedKey,
      expiresAt: Date.now() + cacheTtlMs,
    });
  }

  return derivedKey;
}

/**
 * Encrypts a plaintext secret string using PBKDF2 + AES-256-GCM.
 *
 * @param plaintext - Secret string to encrypt
 * @param passphrase - Master passphrase
 * @returns EncryptedVaultPayload conforming to PRD-017
 */
export async function encryptSecret(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedVaultPayload> {
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string.');
  }
  if (typeof passphrase !== 'string' || passphrase.trim().length === 0) {
    throw new Error('Passphrase must be a non-empty string.');
  }

  const subtle = getSubtleCrypto();

  // 1. Generate 16 bytes cryptographically secure random salt
  const salt = getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));

  // 2. Derive AES-GCM master key
  const masterKey = await deriveMasterKey(passphrase, salt);

  // 3. Generate 12 bytes standard AES-GCM IV
  const iv = getRandomValues(new Uint8Array(IV_BYTE_LENGTH));

  // 4. Encrypt plaintext (returns ciphertext + 128-bit authentication tag)
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  const cipherBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: AUTH_TAG_LENGTH_BITS,
    },
    masterKey,
    encodedPlaintext,
  );

  return {
    version: 1,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(new Uint8Array(cipherBuffer)),
    authTagLength: 128,
  };
}

/**
 * Decrypts an EncryptedVaultPayload using PBKDF2 + AES-256-GCM.
 * Throws an Error if the payload is corrupted, tampered with, or if the passphrase is invalid.
 *
 * @param payload - EncryptedVaultPayload
 * @param passphrase - Master passphrase
 * @returns Decrypted plaintext string
 */
export async function decryptSecret(
  payload: EncryptedVaultPayload,
  passphrase: string,
): Promise<string> {
  if (!isVaultPayload(payload)) {
    throw new Error('Invalid vault payload format: missing required fields or incorrect types.');
  }
  if (typeof passphrase !== 'string' || passphrase.trim().length === 0) {
    throw new Error('Passphrase must be a non-empty string.');
  }

  const subtle = getSubtleCrypto();

  const saltBytes = hexToBytes(payload.saltHex);
  const ivBytes = hexToBytes(payload.ivHex);
  const cipherBytes = hexToBytes(payload.ciphertextHex);

  if (saltBytes.byteLength < SALT_BYTE_LENGTH) {
    throw new Error(`Salt must be at least ${SALT_BYTE_LENGTH} bytes.`);
  }
  if (ivBytes.byteLength !== IV_BYTE_LENGTH) {
    throw new Error(`IV must be exactly ${IV_BYTE_LENGTH} bytes.`);
  }

  const masterKey = await deriveMasterKey(passphrase, saltBytes);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: AUTH_TAG_LENGTH_BITS,
      },
      masterKey,
      cipherBytes,
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (_err) {
    throw new Error('Decryption failed: Invalid passphrase or corrupted vault payload.');
  }
}

/**
 * Verifies whether a given passphrase can successfully decrypt the vault payload.
 *
 * @param payload - EncryptedVaultPayload
 * @param passphrase - Master passphrase to test
 * @returns boolean true if passphrase is correct, false otherwise
 */
export async function verifyPassphrase(
  payload: EncryptedVaultPayload,
  passphrase: string,
): Promise<boolean> {
  if (!isVaultPayload(payload) || typeof passphrase !== 'string' || !passphrase) {
    return false;
  }
  try {
    await decryptSecret(payload, passphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts multiple key-value secrets under the same passphrase.
 */
export async function encryptSecretsMap(
  secrets: Record<string, string>,
  passphrase: string,
): Promise<Record<string, EncryptedVaultPayload>> {
  const result: Record<string, EncryptedVaultPayload> = {};
  for (const [key, plaintext] of Object.entries(secrets)) {
    result[key] = await encryptSecret(plaintext, passphrase);
  }
  return result;
}

/**
 * Decrypts multiple key-value secrets under the same passphrase.
 */
export async function decryptSecretsMap(
  vaults: Record<string, EncryptedVaultPayload>,
  passphrase: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, payload] of Object.entries(vaults)) {
    result[key] = await decryptSecret(payload, passphrase);
  }
  return result;
}
