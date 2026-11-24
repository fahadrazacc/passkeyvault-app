// Time-based one-time codes (RFC 6238), the 6-digit codes used for two-factor sign-in.
// Accepts a plain base32 secret ("JBSW Y3DP …") or an otpauth:// link from a QR code.

export interface TotpSpec {
  secret: Uint8Array<ArrayBuffer>;
  digits: number;
  period: number;
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
  issuer?: string;
  account?: string;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Not a valid setup key');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function parseTotp(raw: string): TotpSpec {
  const s = raw.trim();
  if (/^otpauth:\/\//i.test(s)) {
    const url = new URL(s);
    if (url.host.toLowerCase() !== 'totp') throw new Error('Only time-based (TOTP) codes are supported');
    const p = url.searchParams;
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const [maybeIssuer, maybeAccount] = label.includes(':') ? label.split(':') : [undefined, label];
    const alg = (p.get('algorithm') || 'SHA1').toUpperCase();
    return {
      secret: base32Decode(p.get('secret') || ''),
      digits: clampInt(p.get('digits'), 6, 6, 10),
      period: clampInt(p.get('period'), 30, 5, 300),
      algorithm: alg === 'SHA256' ? 'SHA-256' : alg === 'SHA512' ? 'SHA-512' : 'SHA-1',
      issuer: p.get('issuer') || maybeIssuer || undefined,
      account: maybeAccount?.trim() || undefined,
    };
  }
  return { secret: base32Decode(s), digits: 6, period: 30, algorithm: 'SHA-1' };
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = v ? parseInt(v, 10) : def;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

export function isValidTotp(raw: string) {
  try {
    parseTotp(raw);
    return true;
  } catch {
    return false;
  }
}

/** HOTP (RFC 4226) for a given counter. */
export async function hotp(spec: Pick<TotpSpec, 'secret' | 'digits' | 'algorithm'>, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey('raw', spec.secret, { name: 'HMAC', hash: spec.algorithm }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** spec.digits).padStart(spec.digits, '0');
}

export async function totpNow(spec: TotpSpec, now = Date.now()) {
  const step = Math.floor(now / 1000 / spec.period);
  const code = await hotp(spec, step);
  const remaining = spec.period - (Math.floor(now / 1000) % spec.period);
  return { code, remaining, period: spec.period };
}

/** "482913" -> "482 913" */
export const groupCode = (c: string) => (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c);
