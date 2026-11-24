// Encrypted local vault.
// Everything is serialised to JSON and encrypted with AES-256-GCM before it is stored.
// The key is derived from the master password with PBKDF2-SHA256 (600,000 rounds, OWASP 2023)
// and a random per-vault salt. The key lives only in memory while the vault is unlocked,
// and the master password itself is never stored (except by the phone's secure biometric store, if turned on).

import type { AppData } from './types';

const VAULT_KEY = 'passkey.vault.v1';
const META_KEY = 'passkey.meta.v1';
export const ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const memory: Record<string, string> = {};

function getItem(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return memory[k] ?? null;
  }
}
function setItem(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    memory[k] = v;
  }
}
function removeItem(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    delete memory[k];
  }
}

export const toB64 = (b: Uint8Array) => {
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
};
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

interface VaultBlob {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

export interface Session {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
  iter: number;
}

async function deriveKey(pass: string, salt: Uint8Array<ArrayBuffer>, iter = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function hasVault() {
  return !!getItem(VAULT_KEY);
}

/** Non-secret settings the lock screen needs before the vault is open. */
export interface Meta {
  biometric: boolean;
  theme: 'system' | 'light' | 'dark';
  hint?: string;
  failed: number;
  lockedUntil?: number;
}
export function getMeta(): Meta {
  let m: Partial<Meta> = {};
  try {
    m = JSON.parse(getItem(META_KEY) || '{}');
  } catch {
    /* ignore */
  }
  return {
    biometric: !!m.biometric,
    theme: m.theme === 'dark' || m.theme === 'light' ? m.theme : 'system',
    hint: typeof m.hint === 'string' && m.hint ? m.hint : undefined,
    failed: typeof m.failed === 'number' ? m.failed : 0,
    lockedUntil: typeof m.lockedUntil === 'number' ? m.lockedUntil : undefined,
  };
}
export function setMeta(patch: Partial<Meta>) {
  setItem(META_KEY, JSON.stringify({ ...getMeta(), ...patch }));
}

async function seal(session: Session, data: AppData): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.key, enc.encode(JSON.stringify(data)));
  const blob: VaultBlob = { v: 1, iter: session.iter, salt: toB64(session.salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
  return JSON.stringify(blob);
}

async function unseal(blobText: string, pass: string): Promise<{ session: Session; data: AppData }> {
  const blob = JSON.parse(blobText) as VaultBlob;
  const salt = fromB64(blob.salt);
  const key = await deriveKey(pass, salt, blob.iter);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
  } catch {
    throw new Error('Wrong password');
  }
  return { session: { key, salt, iter: blob.iter }, data: JSON.parse(dec.decode(plain)) as AppData };
}

export async function writeVault(session: Session, data: AppData) {
  setItem(VAULT_KEY, await seal(session, data));
}

export async function createVault(pass: string, data: AppData): Promise<Session> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const session: Session = { key: await deriveKey(pass, salt), salt, iter: ITERATIONS };
  await writeVault(session, data);
  setMeta({ failed: 0, lockedUntil: undefined });
  return session;
}

export async function openVault(pass: string): Promise<{ session: Session; data: AppData }> {
  const raw = getItem(VAULT_KEY);
  if (!raw) throw new Error('No vault on this device');
  return unseal(raw, pass);
}

export async function checkPassword(pass: string) {
  try {
    await openVault(pass);
    return true;
  } catch {
    return false;
  }
}

/** Re-encrypts everything under a new master password (new salt, new key). */
export const changePassword = (pass: string, data: AppData) => createVault(pass, data);

// ---------- backups ----------

/** The encrypted vault exactly as stored: unreadable without the master password. */
export function exportBackup(): string | null {
  const raw = getItem(VAULT_KEY);
  if (!raw) return null;
  return JSON.stringify({ app: 'passkey', exportedAt: new Date().toISOString(), vault: JSON.parse(raw) });
}

/** Opens a PassKey backup file with its master password, without touching this device's vault. */
export async function openBackup(text: string, pass: string) {
  let parsed: { app?: string; vault?: VaultBlob };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a PassKey backup file');
  }
  if (parsed.app !== 'passkey' || !parsed.vault?.salt || !parsed.vault.iv || !parsed.vault.data) throw new Error('This is not a PassKey backup file');
  return unseal(JSON.stringify(parsed.vault), pass);
}

/** Replaces this device's vault with a backup file (used from the welcome screen). */
export function installBackup(text: string) {
  const parsed = JSON.parse(text);
  if (parsed.app !== 'passkey' || !parsed.vault?.salt) throw new Error('This is not a PassKey backup file');
  setItem(VAULT_KEY, JSON.stringify(parsed.vault));
  setMeta({ biometric: false, failed: 0, lockedUntil: undefined });
}

export function wipeVault() {
  removeItem(VAULT_KEY);
  removeItem(META_KEY);
}

// ---------- brute-force slow-down on this device ----------

export function noteFailedUnlock() {
  const m = getMeta();
  const failed = m.failed + 1;
  // After 5 wrong tries, wait 30s, doubling each time (max 15 minutes).
  const wait = failed >= 5 ? Math.min(15 * 60_000, 30_000 * 2 ** (failed - 5)) : 0;
  setMeta({ failed, lockedUntil: wait ? Date.now() + wait : undefined });
  return wait;
}
export const noteGoodUnlock = () => setMeta({ failed: 0, lockedUntil: undefined });
