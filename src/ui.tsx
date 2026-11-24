import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import type { Item, ItemType } from './types';
import { href } from './router';
import { cardBrand, tileColors } from './utils';
import { isDark, onThemeChange } from './theme';
import { estimate } from './strength';
import { groupCode, parseTotp, totpNow } from './totp';
import { copy } from './platform';
import { toast } from './toast';

export function useWide() {
  const q = '(min-width: 960px)';
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setWide(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return wide;
}

export function useDark() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const off = onThemeChange(() => setDark(isDark()));
    return () => {
      off();
    };
  }, []);
  return dark;
}

const TYPE_ICON: Record<ItemType, IconName> = { login: 'key', card: 'card', note: 'note', wifi: 'wifi', identity: 'user' };
export const typeIcon = (t: ItemType) => TYPE_ICON[t];

/** The coloured square shown for each item: its first letter, or an icon for cards, notes, Wi-Fi, identities. */
export function ItemTile({ item, size = 40 }: { item: Pick<Item, 'title' | 'type' | 'cardNumber'>; size?: number }) {
  const dark = useDark();
  const [bg, fg] = tileColors(item.title || '?', dark);
  const letter = (item.title.trim()[0] ?? '?').toUpperCase();
  const r = Math.round(size * 0.3);
  return (
    <span className="tile" style={{ width: size, height: size, borderRadius: r, background: bg, color: fg, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {item.type === 'login' ? letter : item.type === 'card' ? <span style={{ fontSize: Math.round(size * 0.24), fontWeight: 800 }}>{cardBrand(item.cardNumber).slice(0, 4).toUpperCase()}</span> : <Icon name={TYPE_ICON[item.type]} size={Math.round(size * 0.5)} />}
    </span>
  );
}

export function Header(props: { title: ReactNode; sub?: ReactNode; left?: ReactNode; right?: ReactNode; big?: boolean }) {
  if (props.big)
    return (
      <header className="head big">
        <div className="head-title">
          {props.sub && <span className="muted small">{props.sub}</span>}
          <h1 className="h-big">{props.title}</h1>
        </div>
        <div className="head-actions">{props.right}</div>
      </header>
    );
  return (
    <header className="head">
      <div className="head-side">{props.left}</div>
      <h1 className="h-small">{props.title}</h1>
      <div className="head-side right">{props.right}</div>
    </header>
  );
}

export function BackLink({ to, label = 'Back' }: { to: string; label?: string }) {
  return (
    <a className="btn-icon" href={href(to)} aria-label={label}>
      <Icon name="chevL" />
    </a>
  );
}

export function Segmented<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={props.label} style={{ gridTemplateColumns: `repeat(${props.options.length}, minmax(0, 1fr))` }}>
      {props.options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={props.value === o.value} className={props.value === o.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { label: ReactNode; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="row toggle-row">
      <span className="row-main">
        <span className="row-title">{props.label}</span>
        {props.sub && <span className="row-sub">{props.sub}</span>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [props]);
  return (
    <div className="backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button className="btn-icon" aria-label="Close" onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}

export function StrengthBar({ password, compact }: { password: string; compact?: boolean }) {
  const s = estimate(password);
  return (
    <div className="strength" aria-label={`Password strength: ${s.label}`}>
      <div className="strength-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: password && i < Math.max(1, s.level) ? s.color : undefined }} />
        ))}
      </div>
      <span className="small" style={{ color: s.color, fontWeight: 600 }}>
        {s.label}
        {!compact && password ? ` · ${password.length} chars` : ''}
      </span>
    </div>
  );
}

/** Shows a password with digits and symbols coloured, like the design. */
export function ColoredPassword({ value }: { value: string }) {
  return (
    <span className="mono pw">
      {[...value].map((c, i) => (
        <span key={i} className={/\d/.test(c) ? 'pw-d' : /[^A-Za-z0-9]/.test(c) ? 'pw-s' : undefined}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** Live one-time code with a countdown ring. */
export function TotpCode({ secret, big = true, clearSec = 0 }: { secret: string; big?: boolean; clearSec?: number }) {
  const [state, setState] = useState<{ code: string; remaining: number; period: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let spec: ReturnType<typeof parseTotp>;
    try {
      spec = parseTotp(secret);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const tick = () => totpNow(spec).then((s) => alive && setState(s));
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [secret]);
  if (error) return <span className="error">{error}</span>;
  if (!state) return <span className="muted">…</span>;
  const r = big ? 16 : 9;
  const c = 2 * Math.PI * r;
  const low = state.remaining <= 5;
  return (
    <button
      type="button"
      className="totp"
      onClick={() => copy(state.code, clearSec).then(() => toast('Code copied'))}
      aria-label={`One-time code ${state.code}, ${state.remaining} seconds left. Tap to copy.`}
    >
      <span className={`totp-code ${big ? 'big' : ''}`} style={low ? { color: 'var(--warn)' } : undefined}>
        {groupCode(state.code)}
      </span>
      <svg width={r * 2 + 8} height={r * 2 + 8} viewBox={`0 0 ${r * 2 + 8} ${r * 2 + 8}`} aria-hidden="true">
        <circle cx={r + 4} cy={r + 4} r={r} fill="none" stroke="var(--line)" strokeWidth={big ? 4 : 3} />
        <circle
          cx={r + 4}
          cy={r + 4}
          r={r}
          fill="none"
          stroke={low ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth={big ? 4 : 3}
          strokeLinecap="round"
          strokeDasharray={`${(c * state.remaining) / state.period} ${c}`}
          transform={`rotate(-90 ${r + 4} ${r + 4})`}
        />
        {big && (
          <text x={r + 4} y={r + 8} textAnchor="middle" fontSize="12" fill="var(--ink)">
            {state.remaining}
          </text>
        )}
      </svg>
    </button>
  );
}

export function Badge({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'accent' | 'muted'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
