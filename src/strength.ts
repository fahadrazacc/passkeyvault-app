// Password strength estimate. Not a full cracking model, but it catches the usual problems:
// short, one kind of character, common words, keyboard runs, repeats and years.

export type Level = 0 | 1 | 2 | 3 | 4;
export interface Strength {
  level: Level; // 0 very weak … 4 very strong
  label: string;
  bits: number;
  color: string;
  crack: string;
}

const COMMON = new Set(
  'password passw0rd p@ssword 123456 12345678 123456789 1234567890 qwerty qwertyuiop abc123 111111 123123 letmein welcome admin iloveyou monkey dragon football baseball sunshine princess master shadow login trustno1 superman batman pakistan lahore karachi starwars whatever freedom computer michael charlie jordan hello secret summer winter autumn spring changeme default test guest root access'.split(
    ' ',
  ),
);
const RUNS = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc'];

function pool(p: string) {
  let n = 0;
  if (/[a-z]/.test(p)) n += 26;
  if (/[A-Z]/.test(p)) n += 26;
  if (/[0-9]/.test(p)) n += 10;
  if (/[^a-zA-Z0-9]/.test(p)) n += 33;
  return n || 1;
}

export function estimate(p: string): Strength {
  if (!p) return { level: 0, label: 'Empty', bits: 0, color: 'var(--muted)', crack: '' };
  let bits = p.length * Math.log2(pool(p));
  const lower = p.toLowerCase();
  const plain = lower.replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!]/g, 'i').replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/[^a-z]/g, '');

  if (COMMON.has(lower) || COMMON.has(plain)) bits = Math.min(bits, 10);
  // A common word inside the password is worth ~12 bits, not its length in random letters.
  let word = '';
  for (const w of COMMON) if (w.length >= 4 && w.length > word.length && (lower.includes(w) || plain.includes(w))) word = w;
  if (word) bits = Math.min(bits, 12 + Math.max(0, p.length - word.length) * Math.log2(pool(p)));
  // keyboard and alphabet runs of 4+
  for (const r of RUNS)
    for (let i = 0; i + 4 <= r.length; i++) {
      const seg = r.slice(i, i + 4);
      if (lower.includes(seg) || lower.includes([...seg].reverse().join(''))) bits -= 6;
    }
  // repeated characters (aaaa) and repeated chunks (abcabc)
  const reps = p.match(/(.)\1{2,}/g);
  if (reps) bits -= reps.join('').length * 3;
  if (/^(.+)\1+$/.test(p)) bits *= 0.5;
  // years and dates
  if (/(19|20)\d{2}/.test(p)) bits -= 6;
  // only letters followed by digits ("Ahmed1234") is a very common pattern
  if (/^[A-Za-z]+\d{1,4}[!.]?$/.test(p)) bits -= 8;

  bits = Math.max(0, Math.round(bits));
  const level: Level = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { level, bits, label: LABELS[level], color: COLORS[level], crack: crackTime(bits) };
}

export const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
export const COLORS = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--good)', 'var(--good)'];

/** Rough time for an offline attacker making 10 billion guesses a second. */
export function crackTime(bits: number) {
  const secs = 2 ** bits / 2 / 1e10;
  if (secs < 1) return 'instantly';
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [365, 'day'],
    [100, 'year'],
    [10, 'century'],
  ];
  let v = secs;
  let name = 'second';
  for (const [div, n] of units) {
    name = n;
    if (v < div) break;
    v /= div;
    if (n === 'century') name = 'millennium';
  }
  if (name === 'millennium' || name === 'century') {
    const years = secs / 31_536_000;
    if (years > 1e9) return 'billions of years';
    if (years > 1e6) return 'millions of years';
    return `${Math.round(years).toLocaleString()} years`;
  }
  const r = Math.max(1, Math.round(v));
  return `${r} ${name}${r === 1 ? '' : 's'}`;
}
