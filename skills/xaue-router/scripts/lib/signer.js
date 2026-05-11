import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { pbkdf2Sync } from 'crypto';
import { HDNodeWallet, Mnemonic } from 'ethers';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sodium = require('sodium-native');
const b4a = require('b4a');

function expandTilde(p) {
  if (typeof p === 'string' && p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

// ---------------------------------------------------------------------------
// WDK vault decryption — mirrors @tetherto/wdk-secret-manager algorithm
//
// Vault format: { encryptedEntropy: <hex>, salt: <hex> }
// Encryption:   version(1) | nonce(24) | ciphertext(1 + plainLen + MACBYTES)
// ---------------------------------------------------------------------------

function wdkDeriveKey(password, salt) {
  return pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
}

function wdkDecrypt(payload, key) {
  const NONCEBYTES = sodium.crypto_secretbox_NONCEBYTES;
  const MACBYTES   = sodium.crypto_secretbox_MACBYTES;
  if (payload[0] !== 0) throw new Error('WDK vault: unsupported encryption version');
  const nonce  = payload.subarray(1, 1 + NONCEBYTES);
  const cipher = payload.subarray(1 + NONCEBYTES);
  const plain  = b4a.alloc(cipher.byteLength - MACBYTES);
  if (!sodium.crypto_secretbox_open_easy(plain, cipher, nonce, key)) {
    throw new Error('WDK vault: decryption failed — wrong password or corrupted vault');
  }
  const bytes  = plain[0];
  const result = b4a.alloc(bytes);
  result.set(plain.subarray(1, 1 + bytes));
  sodium.sodium_memzero(plain);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an ethers.Wallet from the WDK vault.
 *
 * @param {{ env: object }} cfg   Object with env vars (WALLET_MODE, WDK_VAULT_FILE, …)
 * @param {import('ethers').Provider|null} provider
 * @param {{ accountIndex?: number }} [opts]
 * @returns {Promise<import('ethers').Wallet>}
 */
export async function createSigner(cfg, provider, opts = {}) {
  if (!cfg?.env?.WALLET_MODE) throw new Error('WALLET_MODE not set in ~/.aurehub/.env');
  if (process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY is rejected — use WALLET_MODE=wdk');
  if (cfg.env.WALLET_MODE !== 'wdk') throw new Error(`Unsupported WALLET_MODE "${cfg.env.WALLET_MODE}". Only "wdk" is supported.`);
  return _wdkSigner(cfg, provider, opts);
}

// ---------------------------------------------------------------------------
// WDK backend
// ---------------------------------------------------------------------------

async function _wdkSigner(cfg, provider, opts) {
  const vaultPath = expandTilde(cfg.env.WDK_VAULT_FILE ?? join(homedir(), '.aurehub', '.wdk_vault'));
  let vaultJson;
  try { vaultJson = readFileSync(vaultPath, 'utf8'); }
  catch (err) { throw new Error(`WDK vault not found at "${vaultPath}": ${err.message}`); }

  let vault;
  try { vault = JSON.parse(vaultJson); }
  catch { throw new Error('WDK vault is not valid JSON'); }
  if (!vault.encryptedEntropy || !vault.salt) {
    throw new Error('WDK vault missing fields: encryptedEntropy, salt');
  }

  const passwordFile = expandTilde(cfg.env.WDK_PASSWORD_FILE ?? join(homedir(), '.aurehub', '.wdk_password'));
  try {
    const stat = statSync(passwordFile);
    if ((stat.mode & 0o077) !== 0) {
      throw new Error(`WDK_PASSWORD_FILE "${passwordFile}" must be chmod 600`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`WDK_PASSWORD_FILE not found at "${passwordFile}"`);
    throw err;
  }

  let password;
  try { password = readFileSync(passwordFile, 'utf8').trim(); }
  catch (err) { throw new Error(`Cannot read WDK_PASSWORD_FILE "${passwordFile}": ${err.message}`); }

  const salt             = Buffer.from(vault.salt, 'hex');
  const encryptedEntropy = Buffer.from(vault.encryptedEntropy, 'hex');
  const key              = wdkDeriveKey(password, salt);
  let entropy;
  try { entropy = wdkDecrypt(encryptedEntropy, key); }
  finally { key.fill(0); }

  // Note: Mnemonic.fromEntropy creates a phrase string internally; JS strings cannot be
  // explicitly zeroed. The entropy Buffer is zeroed below, which is the best we can do.
  let wallet;
  try {
    const index = opts.accountIndex ?? parseInt(cfg.env.WDK_ACCOUNT_INDEX || '0', 10);
    if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid WDK_ACCOUNT_INDEX: ${index}`);
    const mnemonic = Mnemonic.fromEntropy(entropy);
    wallet = HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
  } finally { sodium.sodium_memzero(entropy); }

  return provider ? wallet.connect(provider) : wallet;
}

