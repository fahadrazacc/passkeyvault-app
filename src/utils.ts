import type { AppData, Item, ItemType } from './types';
import { DEFAULT_GEN } from './generator';

export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 16);
};

export function emptyData(name = ''): AppData {
  return {
    v: 1,
    items: [],
    folders: [],
    settings: { name, autoLockMin: 1, clipboardClearSec: 30, theme: 'system', gen: { ...DEFAULT_GEN } },
    genHistory: [],
    breaches: {},
  };
}

/** Fills in anything missing from older versions or imports. */
export function normalize(d: Partial<AppData>): AppData {
  const e = emptyData();
  return {
    ...e,
    ...d,
    items: Array.isArray(d.items) ? d.items : [],
    folders: Array.isArray(d.folders) ? d.folders : [],
    settings: { ...e.settings, ...(d.settings ?? {}), gen: { ...e.settings.gen, ...(d.settings?.gen ?? {}) } },
    genHistory: Array.isArray(d.genHistory) ? d.genHistory : [],
    breaches: d.breaches ?? {},
  } as AppData;
}

export const TYPE_LABEL: Record<ItemType, string> = {
  login: 'Login',
  card: 'Payment card',
  note: 'Secure note',
  wifi: 'Wi-Fi',
  identity: 'Identity',
};
export const TYPE_PLURAL: Record<ItemType, string> = {
  login: 'Logins',
  card: 'Cards',
  note: 'Notes',
  wifi: 'Wi-Fi',
  identity: 'Identities',
};

// Pleasant tile colours (background, foreground), picked from the title so they stay stable.
const TILES: [string, string][] = [
  ['#24304D', '#8FB0FF'],
  ['#3A2440', '#E9A8F5'],
  ['#3D2A16', '#FFC27A'],
  ['#16343A', '#7DD3E0'],
  ['#2E2A45', '#C4B5FD'],
  ['#17352B', '#6EE7B7'],
  ['#3A1F2A', '#FDA4C4'],
  ['#2B3318', '#C8E27A'],
];
const TILES_LIGHT: [string, string][] = [
  ['#E4EBFF', '#2F4AC0'],
  ['#F6E5FA', '#8A2BA3'],
  ['#FFF0DC', '#9A4D00'],
  ['#DDF4F7', '#0B6B7A'],
  ['#ECE8FF', '#5B3FC4'],
  ['#DDF5EA', '#0B6B47'],
  ['#FDE6EE', '#A1255A'],
  ['#EEF6D9', '#4C6410'],
];
export function tileColors(seed: string, dark: boolean): [string, string] {
  let h = 0;
  for (const c of seed.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const set = dark ? TILES : TILES_LIGHT;
  return set[h % set.length];
}

export function subtitle(i: Item) {
  switch (i.type) {
    case 'login':
      return i.username || i.urls?.[0] || 'Login';
    case 'card':
      return i.cardNumber ? `•••• ${i.cardNumber.replace(/\D/g, '').slice(-4)}${i.expiry ? ' · exp ' + i.expiry : ''}` : 'Payment card';
    case 'wifi':
      return i.ssid ? `Network: ${i.ssid}` : 'Wi-Fi';
    case 'identity':
      return i.fullName || i.email || 'Identity';
    default:
      return (i.notes ?? '').split('\n')[0].slice(0, 60) || 'Secure note';
  }
}

export function matches(i: Item, q: string) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [i.title, i.username, i.folder, i.notes, i.ssid, i.fullName, i.email, i.cardholder, ...(i.urls ?? [])].some((v) => v && v.toLowerCase().includes(s));
}

export function ago(t?: number) {
  if (!t) return 'never';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Card brand from the number prefix. */
export function cardBrand(n?: string) {
  const d = (n ?? '').replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^62/.test(d)) return 'UnionPay';
  if (/^6/.test(d)) return 'Discover';
  return 'Card';
}

export const groupCard = (n: string) => n.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();

/** Normalises what someone typed as a website into an openable link. */
export const toUrl = (u: string) => (/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u);
