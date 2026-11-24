// Import from LastPass, Chrome / Edge / Brave, Firefox, Safari / Apple Passwords, Bitwarden and 1Password CSV exports.
import type { Item } from './types';
import { uid } from './utils';

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const ALIASES: Record<string, string[]> = {
  title: ['name', 'title', 'account', 'item name'],
  url: ['url', 'login_uri', 'website', 'web site', 'origin', 'login url', 'urls'],
  username: ['username', 'login_username', 'user name', 'login', 'email', 'login name'],
  password: ['password', 'login_password'],
  totp: ['totp', 'login_totp', 'otpauth', 'one-time password', 'otp', 'otpauth url'],
  notes: ['extra', 'notes', 'note', 'comments'],
  folder: ['grouping', 'folder', 'group', 'vault'],
  favorite: ['fav', 'favorite', 'favourite'],
  type: ['type'],
};

export interface ImportResult {
  items: Item[];
  skipped: number;
  source: string;
}

export function importCsv(text: string, now = Date.now()): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The file has no rows to import');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (k: string) => head.findIndex((h) => ALIASES[k].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.password < 0 && idx.notes < 0) throw new Error("This doesn't look like a password export (no password column)");
  const source = head.includes('grouping') && head.includes('extra') ? 'LastPass' : head.includes('login_uri') ? 'Bitwarden' : head.includes('httprealm') ? 'Firefox' : head.includes('otpauth') ? 'Apple Passwords' : 'CSV';

  const items: Item[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '');
    const url = get('url');
    const username = get('username');
    const password = r[idx.password] ?? '';
    const notes = get('notes');
    let title = get('title');
    // LastPass secure notes have url "http://sn" and the note text in "extra".
    const isNote = url === 'http://sn' || get('type') === 'note' || get('type') === 'securenote' || (!password && !username && !!notes);
    if (!title) title = hostOf(url) || username || 'Untitled';
    if (!password && !username && !notes && !url) {
      skipped++;
      continue;
    }
    const folder = get('folder').replace(/\\/g, '/') || undefined;
    const fav = /^(1|true|yes)$/i.test(get('favorite'));
    const base = { id: uid(), title, folder, favorite: fav || undefined, createdAt: now, updatedAt: now, passwordChangedAt: now };
    if (isNote) {
      items.push(fromLastPassNote(base, notes));
      continue;
    }
    items.push({
      ...base,
      type: 'login',
      username: username || undefined,
      password: password || undefined,
      urls: url && url !== 'http://' ? url.split(/[\s,]+/).filter(Boolean) : undefined,
      totp: get('totp') || undefined,
      notes: notes || undefined,
    });
  }
  return { items, skipped, source };
}

/** LastPass exports special notes (cards, Wi-Fi…) as "NoteType:Credit Card\nNumber:…" text. */
function fromLastPassNote(base: Omit<Item, 'type'>, text: string): Item {
  const lines = text.split(/\r?\n/);
  const kv: Record<string, string> = {};
  let typeLine = '';
  for (const l of lines) {
    const m = /^([A-Za-z][A-Za-z ]{1,30}):(.*)$/.exec(l);
    if (m) {
      if (m[1] === 'NoteType') typeLine = m[2].trim();
      else kv[m[1].trim().toLowerCase()] = m[2].trim();
    }
  }
  if (/credit card|payment card/i.test(typeLine))
    return {
      ...base,
      type: 'card',
      cardholder: kv['name on card'] || undefined,
      cardNumber: kv['number'] || undefined,
      expiry: kv['expiration date'] ? lpExpiry(kv['expiration date']) : undefined,
      cvv: kv['security code'] || undefined,
      notes: kv['notes'] || undefined,
    };
  if (/wi-?fi/i.test(typeLine)) return { ...base, type: 'wifi', ssid: kv['ssid'] || undefined, password: kv['password'] || undefined, wifiSecurity: kv['connection type'] || undefined, notes: kv['notes'] || undefined };
  return { ...base, type: 'note', notes: text };
}

function lpExpiry(s: string) {
  // "January,2027" -> "01/27"
  const m = /([A-Za-z]+),\s*(\d{4})/.exec(s);
  if (!m) return s;
  const month = new Date(`${m[1]} 1, 2000`).getMonth() + 1;
  return month ? `${String(month).padStart(2, '0')}/${m[2].slice(2)}` : s;
}

export function hostOf(url?: string) {
  if (!url) return '';
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Plain CSV export (Chrome / Bitwarden-compatible columns). This file is NOT encrypted. */
export function exportCsv(items: Item[]): string {
  const esc = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const out = [['name', 'url', 'username', 'password', 'totp', 'notes', 'folder'].join(',')];
  for (const i of items)
    if (i.type === 'login' || i.type === 'wifi') out.push([i.title, i.urls?.[0] ?? '', i.username ?? i.ssid ?? '', i.password ?? '', i.totp ?? '', i.notes ?? '', i.folder ?? ''].map(esc).join(','));
  return out.join('\n');
}
