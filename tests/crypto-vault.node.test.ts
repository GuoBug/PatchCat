/**
 * @file    tests/crypto-vault.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and contract tests for Web Crypto API (SubtleCrypto AES-256-GCM) Local Cryptographic Vault:
 *   1. PBKDF2 (100,000 iterations SHA-256) master key derivation & validation.
 *   2. AES-256-GCM authenticated encryption and decryption correctness.
 *   3. Unique salt and IV generation across consecutive encryptions.
 *   4. Tamper detection & AEAD MAC integrity checks (ciphertext, IV, salt mutation).
 *   5. Ephemeral in-memory key caching, TTL eviction, and clearMasterKeyCache().
 *   6. verifyPassphrase and batch map helpers.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveMasterKey,
  encryptSecret,
  decryptSecret,
  verifyPassphrase,
  encryptSecretsMap,
  decryptSecretsMap,
  clearMasterKeyCache,
  getMasterKeyCacheStats,
  setMasterKeyCacheTtl,
  isVaultPayload,
  bytesToHex,
  hexToBytes,
  SALT_BYTE_LENGTH,
  IV_BYTE_LENGTH,
  type EncryptedVaultPayload,
} from '../src/services/crypto/crypto-vault.ts';

describe('Phase 4.16: Web Crypto API AES-256-GCM Cryptographic Vault (PRD-017)', () => {
  beforeEach(() => {
    clearMasterKeyCache();
    setMasterKeyCacheTtl(5 * 60 * 1000);
  });

  // ── 1. Master Key Derivation (PBKDF2) ──────────────────────────────────────
  describe('1. PBKDF2 Master Key Derivation', () => {
    it('derives a valid AES-GCM 256-bit CryptoKey with 100,000 iterations', async () => {
      const salt = new Uint8Array(SALT_BYTE_LENGTH);
      for (let i = 0; i < salt.length; i++) salt[i] = i;

      const key = await deriveMasterKey('correct-horse-battery-staple', salt, { useCache: false });

      assert.ok(key);
      assert.equal(key.type, 'secret');
      assert.equal(key.extractable, false);
      const alg = key.algorithm as { name: string; length: number };
      assert.equal(alg.name, 'AES-GCM');
      assert.equal(alg.length, 256);
      assert.deepEqual(key.usages, ['encrypt', 'decrypt']);
    });

    it('rejects empty, whitespace-only or non-string passphrases', async () => {
      const salt = new Uint8Array(SALT_BYTE_LENGTH);

      await assert.rejects(
        () => deriveMasterKey('', salt),
        /Passphrase must be a non-empty string/,
      );
      await assert.rejects(
        () => deriveMasterKey('   ', salt),
        /Passphrase must be a non-empty string/,
      );
      await assert.rejects(
        // @ts-expect-error test invalid type
        () => deriveMasterKey(null, salt),
        /Passphrase must be a non-empty string/,
      );
    });

    it('rejects salt arrays smaller than 16 bytes', async () => {
      const shortSalt = new Uint8Array(15);
      await assert.rejects(
        () => deriveMasterKey('valid-passphrase', shortSalt),
        /Salt must be a Uint8Array of at least 16 bytes/,
      );
    });
  });

  // ── 2. Authenticated Encryption and Decryption Roundtrips ──────────────────
  describe('2. Encryption & Decryption Roundtrip', () => {
    it('encrypts and decrypts standard API keys accurately', async () => {
      const originalKey = 'sk-ant-api03-abcdef1234567890-very-long-secret-credential';
      const passphrase = 'MySuperSecurePassphrase!2026';

      const payload = await encryptSecret(originalKey, passphrase);

      assert.ok(isVaultPayload(payload));
      assert.equal(payload.version, 1);
      assert.equal(payload.authTagLength, 128);
      assert.equal(payload.saltHex.length, 32); // 16 bytes = 32 hex chars
      assert.equal(payload.ivHex.length, 24);   // 12 bytes = 24 hex chars
      assert.ok(payload.ciphertextHex.length > 0);

      const decrypted = await decryptSecret(payload, passphrase);
      assert.equal(decrypted, originalKey);
    });

    it('handles empty string plaintext seamlessly', async () => {
      const payload = await encryptSecret('', 'test-pass');
      assert.ok(isVaultPayload(payload));

      const decrypted = await decryptSecret(payload, 'test-pass');
      assert.equal(decrypted, '');
    });

    it('handles multi-byte Unicode strings and emojis', async () => {
      const unicodeSecret = '🔒 绝密配置：DeepSeek-R1 密钥 🚀 | 12345678-¥$€-中文测试';
      const passphrase = '主口令：测试安全2026';

      const payload = await encryptSecret(unicodeSecret, passphrase);
      const decrypted = await decryptSecret(payload, passphrase);

      assert.equal(decrypted, unicodeSecret);
    });

    it('handles large payloads (50KB JSON document)', async () => {
      const largeDoc = JSON.stringify({
        largeData: Array.from({ length: 500 }, (_, i) => ({
          id: i,
          apiKey: `sk-proj-${i}-secret-${'x'.repeat(80)}`,
        })),
      });
      const passphrase = 'large-doc-passphrase';

      const payload = await encryptSecret(largeDoc, passphrase);
      const decrypted = await decryptSecret(payload, passphrase);

      assert.equal(decrypted, largeDoc);
    });

    it('generates distinct salt, IV and ciphertext for identical plaintext (probabilistic)', async () => {
      const text = 'identical-secret';
      const pass = 'same-password';

      const payload1 = await encryptSecret(text, pass);
      const payload2 = await encryptSecret(text, pass);

      assert.notEqual(payload1.saltHex, payload2.saltHex);
      assert.notEqual(payload1.ivHex, payload2.ivHex);
      assert.notEqual(payload1.ciphertextHex, payload2.ciphertextHex);

      // Both still decrypt to the original text
      assert.equal(await decryptSecret(payload1, pass), text);
      assert.equal(await decryptSecret(payload2, pass), text);
    });
  });

  // ── 3. Tamper Detection & AEAD MAC Integrity ───────────────────────────────
  describe('3. Tamper Detection & AEAD MAC Integrity Checks', () => {
    it('rejects decryption when given an incorrect passphrase', async () => {
      const payload = await encryptSecret('my-secret-key', 'correct-password');

      await assert.rejects(
        () => decryptSecret(payload, 'wrong-password'),
        /Decryption failed: Invalid passphrase or corrupted vault payload\./,
      );
    });

    it('detects tampering in ciphertextHex and aborts decryption', async () => {
      const payload = await encryptSecret('sensitive-data', 'passphrase123');

      // Flip one character in ciphertextHex
      const tamperedChar = payload.ciphertextHex[0] === '0' ? '1' : '0';
      const tamperedPayload: EncryptedVaultPayload = {
        ...payload,
        ciphertextHex: tamperedChar + payload.ciphertextHex.slice(1),
      };

      await assert.rejects(
        () => decryptSecret(tamperedPayload, 'passphrase123'),
        /Decryption failed: Invalid passphrase or corrupted vault payload\./,
      );
    });

    it('detects tampering in ivHex and aborts decryption', async () => {
      const payload = await encryptSecret('sensitive-data', 'passphrase123');

      // Flip one character in ivHex
      const tamperedChar = payload.ivHex[0] === 'a' ? 'b' : 'a';
      const tamperedPayload: EncryptedVaultPayload = {
        ...payload,
        ivHex: tamperedChar + payload.ivHex.slice(1),
      };

      await assert.rejects(
        () => decryptSecret(tamperedPayload, 'passphrase123'),
        /Decryption failed: Invalid passphrase or corrupted vault payload\./,
      );
    });

    it('detects tampering in saltHex and aborts decryption', async () => {
      const payload = await encryptSecret('sensitive-data', 'passphrase123');

      // Flip one character in saltHex
      const tamperedChar = payload.saltHex[0] === 'c' ? 'd' : 'c';
      const tamperedPayload: EncryptedVaultPayload = {
        ...payload,
        saltHex: tamperedChar + payload.saltHex.slice(1),
      };

      await assert.rejects(
        () => decryptSecret(tamperedPayload, 'passphrase123'),
        /Decryption failed: Invalid passphrase or corrupted vault payload\./,
      );
    });

    it('rejects malformed payload structures and invalid versions', async () => {
      // @ts-expect-error invalid version
      const badVersion: EncryptedVaultPayload = {
        version: 2,
        saltHex: '0'.repeat(32),
        ivHex: '0'.repeat(24),
        ciphertextHex: 'abcd',
        authTagLength: 128,
      };
      await assert.rejects(() => decryptSecret(badVersion, 'pass'));

      // @ts-expect-error invalid authTagLength
      const badTagLength: EncryptedVaultPayload = {
        version: 1,
        saltHex: '0'.repeat(32),
        ivHex: '0'.repeat(24),
        ciphertextHex: 'abcd',
        authTagLength: 96,
      };
      await assert.rejects(() => decryptSecret(badTagLength, 'pass'));
    });
  });

  // ── 4. Ephemeral In-Memory Master Key Caching ──────────────────────────────
  describe('4. Ephemeral In-Memory Master Key Caching & Memory Protection', () => {
    it('caches derived CryptoKeys and reuses them for identical salt and passphrase', async () => {
      const salt = new Uint8Array(SALT_BYTE_LENGTH);
      salt.fill(42);
      const passphrase = 'reused-master-passphrase';

      assert.equal(getMasterKeyCacheStats().size, 0);

      // First derivation populates cache
      const key1 = await deriveMasterKey(passphrase, salt, { useCache: true });
      assert.equal(getMasterKeyCacheStats().size, 1);

      // Second derivation retrieves from cache
      const key2 = await deriveMasterKey(passphrase, salt, { useCache: true });
      assert.strictEqual(key1, key2);

      // Different salt creates new cache entry
      const salt2 = new Uint8Array(SALT_BYTE_LENGTH);
      salt2.fill(99);
      const key3 = await deriveMasterKey(passphrase, salt2, { useCache: true });
      assert.notStrictEqual(key1, key3);
      assert.equal(getMasterKeyCacheStats().size, 2);
    });

    it('clearMasterKeyCache immediately purges all keys from memory', async () => {
      const salt = new Uint8Array(SALT_BYTE_LENGTH);
      salt.fill(7);
      await deriveMasterKey('test-pass', salt, { useCache: true });

      assert.equal(getMasterKeyCacheStats().size, 1);
      clearMasterKeyCache();
      assert.equal(getMasterKeyCacheStats().size, 0);
    });

    it('evicts expired keys based on setMasterKeyCacheTtl', async () => {
      setMasterKeyCacheTtl(10); // 10ms TTL
      const salt = new Uint8Array(SALT_BYTE_LENGTH);
      salt.fill(11);

      await deriveMasterKey('short-ttl-pass', salt, { useCache: true });
      assert.equal(getMasterKeyCacheStats().size, 1);

      // Wait 25ms for expiration
      await new Promise((r) => setTimeout(r, 25));

      assert.equal(getMasterKeyCacheStats().size, 0);
    });
  });

  // ── 5. Passphrase Verification & Batch Operations ──────────────────────────
  describe('5. Passphrase Verification & Batch Map Helpers', () => {
    it('verifyPassphrase returns true for valid passphrase and false for invalid', async () => {
      const payload = await encryptSecret('secret-token', 'my-pass-2026');

      const isValid = await verifyPassphrase(payload, 'my-pass-2026');
      assert.equal(isValid, true);

      const isInvalid = await verifyPassphrase(payload, 'wrong-pass');
      assert.equal(isInvalid, false);

      const isEmpty = await verifyPassphrase(payload, '');
      assert.equal(isEmpty, false);
    });

    it('encryptSecretsMap and decryptSecretsMap batch encrypt and decrypt maps', async () => {
      const secrets = {
        openai: 'sk-openai-token-12345',
        deepseek: 'sk-deepseek-token-67890',
        siliconflow: 'sk-siliconflow-token-abcde',
      };
      const passphrase = 'org-master-key';

      const encryptedMap = await encryptSecretsMap(secrets, passphrase);
      assert.ok(isVaultPayload(encryptedMap['openai']));
      assert.ok(isVaultPayload(encryptedMap['deepseek']));
      assert.ok(isVaultPayload(encryptedMap['siliconflow']));

      const decryptedMap = await decryptSecretsMap(encryptedMap, passphrase);
      assert.deepEqual(decryptedMap, secrets);
    });
  });

  // ── 6. Hex Utilities ───────────────────────────────────────────────────────
  describe('6. Hex Conversion Utilities', () => {
    it('converts bytes to hex and back losslessly', () => {
      const bytes = new Uint8Array([0, 15, 16, 255, 128, 42]);
      const hex = bytesToHex(bytes);
      assert.equal(hex, '000f10ff802a');

      const restored = hexToBytes(hex);
      assert.deepEqual(restored, bytes);
    });

    it('rejects invalid hex characters or odd-length strings', () => {
      assert.throws(() => hexToBytes('abc'), /Invalid hexadecimal string/);
      assert.throws(() => hexToBytes('zz'), /Invalid hexadecimal string/);
    });
  });
});
