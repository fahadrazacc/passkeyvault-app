export type ItemType = 'login' | 'card' | 'note' | 'wifi' | 'identity';

export interface HistoryEntry {
  password: string;
  changedAt: number;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  secret: boolean;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  folder?: string;
  favorite?: boolean;
  notes?: string;
  // login
  username?: string;
  password?: string;
  urls?: string[];
  totp?: string; // base32 secret or otpauth:// URI
  // card
  cardholder?: string;
  cardNumber?: string;
  expiry?: string; // MM/YY
  cvv?: string;
  cardPin?: string;
  // wifi
  ssid?: string;
  wifiSecurity?: string;
  // identity
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  fields?: CustomField[];
  history?: HistoryEntry[];
  createdAt: number;
  updatedAt: number;
  usedAt?: number;
  passwordChangedAt?: number;
}

export interface GenOptions {
  mode: 'random' | 'passphrase' | 'pin';
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
  pinLength: number;
}

export interface Settings {
  name: string;
  autoLockMin: number; // minutes away (in background / idle) before locking; 0 = right away
  clipboardClearSec: number; // 0 = never
  theme: 'system' | 'light' | 'dark';
  gen: GenOptions;
}

export interface BreachResult {
  count: number;
  hash: string; // short SHA-1 of the password that was checked, so a changed password shows as unchecked
  at: number;
}

export interface AppData {
  v: 1;
  items: Item[];
  folders: string[];
  settings: Settings;
  genHistory: { value: string; at: number }[];
  breaches: Record<string, BreachResult>;
  breachCheckedAt?: number;
}
