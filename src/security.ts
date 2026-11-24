// Vault health: weak, reused, old and breached passwords, and logins missing two-factor.
import type { AppData, Item } from './types';
import { estimate } from './strength';

export const OLD_DAYS = 365;

export interface Report {
  weak: Item[];
  reused: Item[][]; // groups sharing one password
  reusedCount: number;
  old: Item[];
  breached: Item[];
  no2fa: Item[];
  score: number;
  checked: number;
  /** Items with at least one problem (breached, reused or weak), each counted once. */
  problems: number;
}

const withPassword = (d: AppData) => d.items.filter((i) => (i.type === 'login' || i.type === 'wifi') && !!i.password);

export async function sha1Hex(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function report(d: AppData, now = Date.now()): Report {
  const items = withPassword(d);
  const weak = items.filter((i) => estimate(i.password!).level <= 1);
  const groups = new Map<string, Item[]>();
  for (const i of items) groups.set(i.password!, [...(groups.get(i.password!) ?? []), i]);
  const reused = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
  const reusedCount = reused.reduce((n, g) => n + g.length, 0);
  const old = items.filter((i) => now - (i.passwordChangedAt ?? i.createdAt) > OLD_DAYS * 86_400_000);
  const breached = items.filter((i) => (d.breaches[i.id]?.count ?? 0) > 0);
  const no2fa = d.items.filter((i) => i.type === 'login' && !i.totp && !!i.password);

  const n = items.length || 1;
  const bad = new Set([...weak, ...reused.flat(), ...breached].map((i) => i.id));
  // Breached counts double, old counts a little.
  const penalty = (bad.size + breached.length + old.length * 0.25) / n;
  const score = items.length ? Math.max(0, Math.min(100, Math.round(100 - penalty * 100))) : 100;
  return { weak, reused, reusedCount, old, breached, no2fa, score, checked: items.length, problems: bad.size };
}

/**
 * Checks passwords against Have I Been Pwned using k-anonymity: only the first 5 characters of
 * each password's SHA-1 hash leave the device, never the password or the full hash.
 */
export async function checkBreaches(d: AppData, onProgress?: (done: number, total: number) => void): Promise<AppData['breaches']> {
  const items = withPassword(d);
  const out: AppData['breaches'] = {};
  const byPrefix = new Map<string, string>();
  let done = 0;
  for (const i of items) {
    const hash = await sha1Hex(i.password!);
    const prefix = hash.slice(0, 5);
    let body = byPrefix.get(prefix);
    if (body === undefined) {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' } });
      if (!res.ok) throw new Error('The breach check service is not responding. Try again later.');
      body = await res.text();
      byPrefix.set(prefix, body);
    }
    const line = body.split('\n').find((l) => l.startsWith(hash.slice(5)));
    const count = line ? parseInt(line.split(':')[1], 10) || 0 : 0;
    out[i.id] = { count, hash: hash.slice(0, 10), at: Date.now() };
    onProgress?.(++done, items.length);
  }
  return out;
}

/** Breach results only stay valid while the password is unchanged. */
export async function pruneBreaches(d: AppData): Promise<AppData['breaches']> {
  const out: AppData['breaches'] = {};
  for (const i of withPassword(d)) {
    const r = d.breaches[i.id];
    if (r && r.hash === (await sha1Hex(i.password!)).slice(0, 10)) out[i.id] = r;
  }
  return out;
}
