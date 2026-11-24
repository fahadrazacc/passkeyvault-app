// Password, passphrase and PIN generator. Uses the browser's cryptographic random source
// with rejection sampling, so every character is equally likely.
import type { GenOptions } from './types';
import { WORDS } from './wordlist';

export const DEFAULT_GEN: GenOptions = {
  mode: 'random',
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
  words: 5,
  separator: '-',
  capitalize: true,
  includeNumber: true,
  pinLength: 6,
};

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

/** A uniformly random integer in [0, max). */
export function randInt(max: number): number {
  if (max <= 0 || max > 2 ** 32) throw new Error('bad range');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

const pick = (s: string) => s[randInt(s.length)];

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomPassword(o: GenOptions): string {
  const sets = (['upper', 'lower', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!sets.length) sets.push(SETS.lower);
  const length = Math.max(4, Math.min(128, o.length));
  const all = sets.join('');
  // At least one character from each chosen set, the rest from all of them, then shuffle.
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  return shuffle(chars).slice(0, length).join('');
}

export function passphrase(o: GenOptions): string {
  const n = Math.max(3, Math.min(12, o.words));
  const words = Array.from({ length: n }, () => {
    const w = WORDS[randInt(WORDS.length)];
    return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (o.includeNumber) {
    const i = randInt(words.length);
    words[i] = words[i] + randInt(10);
  }
  return words.join(o.separator);
}

export function pin(o: GenOptions): string {
  const n = Math.max(4, Math.min(12, o.pinLength));
  return Array.from({ length: n }, () => String(randInt(10))).join('');
}

export function generate(o: GenOptions): string {
  return o.mode === 'passphrase' ? passphrase(o) : o.mode === 'pin' ? pin(o) : randomPassword(o);
}

/** Bits of entropy of what the generator itself produced (exact, since we know how it was made). */
export function generatedBits(o: GenOptions): number {
  if (o.mode === 'pin') return Math.max(4, o.pinLength) * Math.log2(10);
  if (o.mode === 'passphrase') return Math.max(3, o.words) * Math.log2(WORDS.length) + (o.includeNumber ? Math.log2(10) : 0);
  let pool = 0;
  for (const k of ['upper', 'lower', 'digits', 'symbols'] as const) if (o[k]) pool += (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length;
  return Math.max(4, o.length) * Math.log2(pool || 26);
}
