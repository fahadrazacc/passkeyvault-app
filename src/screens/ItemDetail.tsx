import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { go, href } from '../router';
import { BackLink, ColoredPassword, Empty, Header, ItemTile, Sheet, StrengthBar, TotpCode } from '../ui';
import { copy } from '../platform';
import { toast } from '../toast';
import { ask } from '../confirm';
import { cardBrand, fmtDate, groupCard, TYPE_LABEL, toUrl } from '../utils';
import { hostOf } from '../importer';
import { report } from '../security';

export function ItemDetail({ id, back = 'vault', embedded }: { id: string; back?: string; embedded?: boolean }) {
  const { data, update } = useStore();
  const item = data.items.find((i) => i.id === id);
  const [history, setHistory] = useState(false);
  const health = useMemo(() => report(data), [data]);
  if (!item) return <Empty icon="search" title="Item not found" text="It may have been deleted." action={<a href={href(back)}>Back to vault</a>} />;

  const clear = data.settings.clipboardClearSec;
  const touch = () => update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, usedAt: Date.now() } : i)) }));
  const doCopy = (value: string, what: string, secret: boolean) =>
    copy(value, secret ? clear : 0).then(() => {
      toast(secret && clear ? `${what} copied · clears in ${clear}s` : `${what} copied`);
      touch();
    });

  const toggleFav = () => update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) }));
  const remove = async () => {
    if (!(await ask(`Delete "${item.title}"? This can't be undone.`))) return;
    update((d) => {
      const breaches = { ...d.breaches };
      delete breaches[id];
      return { ...d, items: d.items.filter((i) => i.id !== id), breaches };
    });
    toast('Deleted');
    go(back);
  };

  const breach = data.breaches[id]?.count ?? 0;
  const reusedWith = health.reused.find((g) => g.some((i) => i.id === id))?.filter((i) => i.id !== id) ?? [];
  const weak = health.weak.some((i) => i.id === id);

  return (
    <div className={embedded ? 'detail' : 'page detail'}>
      <Header
        title=""
        left={!embedded ? <BackLink to={back} /> : undefined}
        right={
          <>
            <button className={`btn-icon ${item.favorite ? 'fav-on' : ''}`} onClick={toggleFav} aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!item.favorite}>
              <Icon name="star" fill={item.favorite ? 'currentColor' : 'none'} />
            </button>
            <a className="btn secondary small-btn" href={href(`edit?id=${id}&back=${encodeURIComponent(embedded ? `item?id=${id}` : `item?id=${id}`)}`)}>
              Edit
            </a>
          </>
        }
      />
      <div className="detail-head">
        <ItemTile item={item} size={60} />
        <div className="row-main">
          <h1 className="h-item">{item.title}</h1>
          <span className="muted small">
            {item.type === 'login' && item.urls?.[0] ? hostOf(item.urls[0]) : TYPE_LABEL[item.type]}
            {item.folder ? ` · ${item.folder}` : ''}
          </span>
        </div>
      </div>

      {breach > 0 && (
        <div className="banner bad">
          <span className="banner-icon">
            <Icon name="alert" size={20} />
          </span>
          <span className="row-main">
            <span className="row-title">This password was found in a data breach</span>
            <span className="row-sub">Seen {breach.toLocaleString()} times in leaked password lists. Change it on the website, then update it here.</span>
          </span>
        </div>
      )}
      {!breach && reusedWith.length > 0 && (
        <div className="banner warn">
          <span className="banner-icon">
            <Icon name="alert" size={20} />
          </span>
          <span className="row-main">
            <span className="row-title">Same password as {reusedWith.length === 1 ? reusedWith[0].title : `${reusedWith.length} other items`}</span>
            <span className="row-sub">If one site is hacked, the others are at risk too. Give each one its own password.</span>
          </span>
        </div>
      )}

      {item.type === 'login' && (
        <div className="card list">
          {item.username && <Field label="Username" value={item.username} onCopy={() => doCopy(item.username!, 'Username', false)} />}
          {item.password && (
            <SecretField label="Password" value={item.password} onCopy={() => doCopy(item.password!, 'Password', true)} colored>
              <StrengthBar password={item.password} />
              {weak && !breach && <span className="small warn-text">This password is easy to guess.</span>}
            </SecretField>
          )}
          {item.totp && (
            <div className="field-row">
              <div className="row-main">
                <span className="f-label">One-time code (2FA)</span>
                <TotpCode secret={item.totp} clearSec={clear} />
              </div>
            </div>
          )}
        </div>
      )}

      {item.type === 'card' && (
        <>
          <div className="pay-card" aria-hidden="true">
            <span className="pay-brand">{cardBrand(item.cardNumber)}</span>
            <span className="mono pay-num">•••• •••• •••• {(item.cardNumber ?? '').replace(/\D/g, '').slice(-4) || '••••'}</span>
            <span className="pay-foot">
              <span>{item.cardholder || 'Cardholder'}</span>
              <span>{item.expiry || 'MM/YY'}</span>
            </span>
          </div>
          <div className="card list">
            {item.cardholder && <Field label="Name on card" value={item.cardholder} onCopy={() => doCopy(item.cardholder!, 'Name', false)} />}
            {item.cardNumber && <SecretField label="Card number" value={groupCard(item.cardNumber)} onCopy={() => doCopy(item.cardNumber!.replace(/\D/g, ''), 'Card number', true)} />}
            {item.expiry && <Field label="Expires" value={item.expiry} onCopy={() => doCopy(item.expiry!, 'Expiry', false)} />}
            {item.cvv && <SecretField label="Security code (CVV)" value={item.cvv} onCopy={() => doCopy(item.cvv!, 'CVV', true)} />}
            {item.cardPin && <SecretField label="PIN" value={item.cardPin} onCopy={() => doCopy(item.cardPin!, 'PIN', true)} />}
          </div>
        </>
      )}

      {item.type === 'wifi' && (
        <div className="card list">
          {item.ssid && <Field label="Network name" value={item.ssid} onCopy={() => doCopy(item.ssid!, 'Network name', false)} />}
          {item.password && <SecretField label="Password" value={item.password} onCopy={() => doCopy(item.password!, 'Password', true)} colored />}
          {item.wifiSecurity && <Field label="Security" value={item.wifiSecurity} />}
        </div>
      )}

      {item.type === 'identity' && (
        <div className="card list">
          {item.fullName && <Field label="Full name" value={item.fullName} onCopy={() => doCopy(item.fullName!, 'Name', false)} />}
          {item.email && <Field label="Email" value={item.email} onCopy={() => doCopy(item.email!, 'Email', false)} />}
          {item.phone && <Field label="Phone" value={item.phone} onCopy={() => doCopy(item.phone!, 'Phone', false)} />}
          {item.address && <Field label="Address" value={item.address} multiline onCopy={() => doCopy(item.address!, 'Address', false)} />}
        </div>
      )}

      {((item.urls?.length ?? 0) > 0 || (item.fields?.length ?? 0) > 0 || item.notes) && (
        <div className="card list">
          {item.urls?.map((u, n) => (
            <div className="field-row" key={n}>
              <div className="row-main">
                <span className="f-label">{n === 0 ? 'Website' : `Website ${n + 1}`}</span>
                <a className="f-value link" href={toUrl(u)} target="_blank" rel="noopener noreferrer">
                  {u.replace(/^https?:\/\//, '')}
                </a>
              </div>
              <a className="btn-icon soft" href={toUrl(u)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${hostOf(u)}`}>
                <Icon name="link" size={18} />
              </a>
            </div>
          ))}
          {item.fields?.map((f) =>
            f.secret ? (
              <SecretField key={f.id} label={f.label || 'Field'} value={f.value} onCopy={() => doCopy(f.value, f.label || 'Field', true)} />
            ) : (
              <Field key={f.id} label={f.label || 'Field'} value={f.value} onCopy={() => doCopy(f.value, f.label || 'Field', false)} />
            ),
          )}
          {item.notes && <Field label="Notes" value={item.notes} multiline />}
        </div>
      )}

      <div className="detail-foot">
        <span>
          Modified {fmtDate(item.updatedAt)} · Created {fmtDate(item.createdAt)}
        </span>
        {(item.history?.length ?? 0) > 0 && (
          <button className="link-btn" onClick={() => setHistory(true)}>
            Password history ({item.history!.length})
          </button>
        )}
      </div>
      <button className="btn danger-ghost" onClick={remove}>
        <Icon name="trash" size={18} /> Delete item
      </button>

      {history && (
        <Sheet title="Password history" onClose={() => setHistory(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Earlier passwords for {item.title}, newest first.
          </p>
          <div className="card list">
            {[...(item.history ?? [])].reverse().map((h, n) => (
              <SecretField key={n} label={`Used until ${fmtDate(h.changedAt)}`} value={h.password} onCopy={() => doCopy(h.password, 'Old password', true)} />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Field({ label, value, onCopy, multiline }: { label: string; value: string; onCopy?: () => void; multiline?: boolean }) {
  return (
    <div className="field-row">
      <div className="row-main">
        <span className="f-label">{label}</span>
        <span className={`f-value ${multiline ? 'pre' : ''}`}>{value}</span>
      </div>
      {onCopy && (
        <button className="btn-icon soft accent" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
          <Icon name="copy" size={18} />
        </button>
      )}
    </div>
  );
}

function SecretField({ label, value, onCopy, colored, children }: { label: string; value: string; onCopy: () => void; colored?: boolean; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field-row col">
      <div className="field-line">
        <div className="row-main">
          <span className="f-label">{label}</span>
          <span className="f-value mono">{show ? colored ? <ColoredPassword value={value} /> : value : '•'.repeat(Math.min(16, Math.max(8, value.length)))}</span>
        </div>
        <button className="btn-icon soft" onClick={() => setShow(!show)} aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
        </button>
        <button className="btn-icon soft accent" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
          <Icon name="copy" size={18} />
        </button>
      </div>
      {children}
    </div>
  );
}

