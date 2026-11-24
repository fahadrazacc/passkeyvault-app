import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { go } from '../router';
import { BackLink, Header, ItemTile, Segmented, Sheet, StrengthBar, Toggle } from '../ui';
import type { CustomField, Item, ItemType } from '../types';
import { TYPE_LABEL, uid } from '../utils';
import { isValidTotp } from '../totp';
import { hostOf } from '../importer';
import { generate } from '../generator';
import { GeneratorPanel } from './Generator';
import { toast } from '../toast';

const TYPES: ItemType[] = ['login', 'card', 'note', 'wifi', 'identity'];

export function EditItem({ id, presetType, back }: { id: string | null; presetType: ItemType | null; back?: string | null }) {
  const { data, update } = useStore();
  const existing = id ? data.items.find((i) => i.id === id) : undefined;
  const [it, setIt] = useState<Item>(
    () =>
      existing ?? {
        id: uid(),
        type: presetType ?? 'login',
        title: '',
        urls: [''],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
  );
  const [showPw, setShowPw] = useState(!existing);
  const [gen, setGen] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Item>) => setIt((x) => ({ ...x, ...patch }));
  const folders = useMemo(() => [...new Set([...data.folders, ...data.items.map((i) => i.folder).filter(Boolean)])] as string[], [data]);
  const backTo = back || (existing ? `item?id=${existing.id}` : 'vault');

  const save = () => {
    setError('');
    const urls = (it.urls ?? []).map((u) => u.trim()).filter(Boolean);
    const title = it.title.trim() || hostOf(urls[0]) || it.ssid || it.fullName || '';
    if (!title) return setError('Give it a name');
    if (it.totp && !isValidTotp(it.totp)) return setError("The two-factor setup key isn't valid. Paste the key or otpauth:// link exactly as the website shows it.");
    const now = Date.now();
    const pwChanged = !!existing && (existing.password ?? '') !== (it.password ?? '');
    const history = pwChanged && existing!.password ? [...(existing!.history ?? []), { password: existing!.password, changedAt: now }].slice(-10) : it.history;
    const clean: Item = {
      ...it,
      title,
      urls: urls.length ? urls : undefined,
      fields: it.fields?.filter((f) => f.label || f.value),
      folder: it.folder?.trim() || undefined,
      totp: it.totp?.trim() || undefined,
      updatedAt: now,
      history,
      passwordChangedAt: pwChanged || !existing ? now : it.passwordChangedAt,
    };
    update((d) => ({
      ...d,
      items: existing ? d.items.map((i) => (i.id === it.id ? clean : i)) : [...d.items, clean],
      folders: clean.folder && !d.folders.includes(clean.folder) ? [...d.folders, clean.folder] : d.folders,
    }));
    toast(existing ? 'Saved' : 'Added to vault');
    go(`item?id=${clean.id}`);
  };

  const pwField = (label = 'Password') => (
    <div className="field">
      <label htmlFor="e-pw">{label}</label>
      <div className="input-wrap">
        <input id="e-pw" className="input mono" type={showPw ? 'text' : 'password'} value={it.password ?? ''} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" spellCheck={false} />
        <button type="button" className="btn-icon in" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
          <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} />
        </button>
        <button type="button" className="btn-icon in accent" onClick={() => setGen(true)} aria-label="Generate a password">
          <Icon name="dice" size={18} />
        </button>
      </div>
      {it.password && <StrengthBar password={it.password} />}
      {!it.password && (
        <button
          type="button"
          className="link-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            set({ password: generate({ ...data.settings.gen, mode: 'random' }) });
            setShowPw(true);
          }}
        >
          Fill in a strong password
        </button>
      )}
    </div>
  );

  const text = (key: keyof Item, label: string, opts: { type?: string; auto?: string; mode?: 'numeric' | 'email' | 'tel'; placeholder?: string; mono?: boolean } = {}) => (
    <div className="field">
      <label htmlFor={`e-${key}`}>{label}</label>
      <input
        id={`e-${key}`}
        className={`input ${opts.mono ? 'mono' : ''}`}
        type={opts.type ?? 'text'}
        inputMode={opts.mode}
        autoComplete={opts.auto ?? 'off'}
        placeholder={opts.placeholder}
        value={(it[key] as string | undefined) ?? ''}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Item>)}
      />
    </div>
  );

  const setField = (fid: string, patch: Partial<CustomField>) => set({ fields: it.fields?.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });

  return (
    <div className="page narrow">
      <Header
        title={existing ? `Edit ${TYPE_LABEL[it.type].toLowerCase()}` : `New ${TYPE_LABEL[it.type].toLowerCase()}`}
        left={<BackLink to={backTo} label="Cancel" />}
        right={
          <button className="btn primary small-btn" onClick={save}>
            Save
          </button>
        }
      />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!existing && (
          <div className="type-pick" role="radiogroup" aria-label="Item type">
            {TYPES.map((t) => (
              <button type="button" key={t} role="radio" aria-checked={it.type === t} className={`type-btn ${it.type === t ? 'on' : ''}`} onClick={() => set({ type: t })}>
                <ItemTile item={{ title: it.title || TYPE_LABEL[t], type: t }} size={34} />
                <span>{TYPE_LABEL[t].replace('Payment card', 'Card').replace('Secure note', 'Note')}</span>
              </button>
            ))}
          </div>
        )}

        <div className="card form-card">
          <div className="field">
            <label htmlFor="e-title">Name</label>
            <input id="e-title" className="input" value={it.title} onChange={(e) => set({ title: e.target.value })} placeholder={it.type === 'login' ? 'e.g. GitHub' : it.type === 'card' ? 'e.g. Visa (personal)' : ''} autoFocus={!existing} />
          </div>
          {it.type === 'login' && (
            <>
              {text('username', 'Username or email', { auto: 'off' })}
              {pwField()}
              <div className="field">
                <label htmlFor="e-url0">Website</label>
                {(it.urls?.length ? it.urls : ['']).map((u, n) => (
                  <div className="input-wrap" key={n}>
                    <input
                      id={n === 0 ? 'e-url0' : undefined}
                      aria-label={n === 0 ? undefined : `Website ${n + 1}`}
                      className="input"
                      inputMode="url"
                      placeholder="example.com"
                      value={u}
                      onChange={(e) => set({ urls: (it.urls?.length ? it.urls : ['']).map((x, k) => (k === n ? e.target.value : x)) })}
                    />
                    {n > 0 && (
                      <button type="button" className="btn-icon in" aria-label="Remove website" onClick={() => set({ urls: it.urls!.filter((_, k) => k !== n) })}>
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => set({ urls: [...(it.urls?.length ? it.urls : ['']), ''] })}>
                  + Add another website
                </button>
              </div>
              <div className="field">
                <label htmlFor="e-totp">Two-factor setup key (optional)</label>
                <input id="e-totp" className="input mono" value={it.totp ?? ''} onChange={(e) => set({ totp: e.target.value })} placeholder="JBSW Y3DP EHPK 3PXP or otpauth://…" spellCheck={false} autoComplete="off" />
                <span className="muted small">When a site offers an authenticator app, choose "can't scan the code?" and paste the key here. PassKey Vault will show the 6-digit codes.</span>
              </div>
            </>
          )}
          {it.type === 'card' && (
            <>
              {text('cardholder', 'Name on card', { auto: 'off' })}
              {text('cardNumber', 'Card number', { mode: 'numeric', mono: true })}
              <div className="grid2">
                {text('expiry', 'Expiry (MM/YY)', { mode: 'numeric', placeholder: '08/29' })}
                {text('cvv', 'CVV', { mode: 'numeric', type: 'password' })}
              </div>
              {text('cardPin', 'PIN (optional)', { mode: 'numeric', type: 'password' })}
            </>
          )}
          {it.type === 'wifi' && (
            <>
              {text('ssid', 'Network name (SSID)')}
              {pwField('Wi-Fi password')}
              <div className="field">
                <span className="f-label">Security</span>
                <Segmented label="Wi-Fi security" value={(it.wifiSecurity as 'WPA3') || 'WPA2'} onChange={(v) => set({ wifiSecurity: v })} options={['WPA2', 'WPA3', 'WEP', 'Open'].map((v) => ({ value: v as 'WPA3', label: v }))} />
              </div>
            </>
          )}
          {it.type === 'identity' && (
            <>
              {text('fullName', 'Full name')}
              {text('email', 'Email', { type: 'email', mode: 'email' })}
              {text('phone', 'Phone', { type: 'tel', mode: 'tel' })}
              <div className="field">
                <label htmlFor="e-address">Address</label>
                <textarea id="e-address" className="input" rows={3} value={it.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
              </div>
            </>
          )}
        </div>

        {(it.fields?.length ?? 0) > 0 && (
          <div className="card form-card">
            <span className="label" style={{ margin: 0 }}>
              Extra fields
            </span>
            {it.fields!.map((f) => (
              <div className="custom-field" key={f.id}>
                <input className="input" aria-label="Field name" placeholder="Field name (e.g. Security question)" value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} />
                <div className="input-wrap">
                  <input className="input" aria-label={`${f.label || 'Field'} value`} placeholder="Value" type={f.secret ? 'password' : 'text'} value={f.value} onChange={(e) => setField(f.id, { value: e.target.value })} />
                  <button type="button" className={`btn-icon in ${f.secret ? 'accent' : ''}`} aria-label={f.secret ? 'Hidden field (tap to make it visible)' : 'Visible field (tap to hide)'} aria-pressed={f.secret} onClick={() => setField(f.id, { secret: !f.secret })}>
                    <Icon name={f.secret ? 'lock' : 'eye'} size={16} />
                  </button>
                  <button type="button" className="btn-icon in" aria-label="Remove field" onClick={() => set({ fields: it.fields!.filter((x) => x.id !== f.id) })}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card form-card">
          <div className="field">
            <label htmlFor="e-notes">{it.type === 'note' ? 'Note' : 'Notes'}</label>
            <textarea id="e-notes" className="input" rows={it.type === 'note' ? 8 : 3} value={it.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="e-folder">Folder</label>
            <input id="e-folder" className="input" list="folders" value={it.folder ?? ''} onChange={(e) => set({ folder: e.target.value })} placeholder="e.g. Work, Family, Banking" />
            <datalist id="folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <Toggle label="Favorite" checked={!!it.favorite} onChange={(favorite) => set({ favorite })} />
        </div>

        <button type="button" className="btn secondary" onClick={() => set({ fields: [...(it.fields ?? []), { id: uid(), label: '', value: '', secret: false }] })}>
          <Icon name="plus" size={18} /> Add a field
        </button>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        <button className="btn primary">{existing ? 'Save changes' : 'Save to vault'}</button>
      </form>

      {gen && (
        <Sheet title="Generate a password" onClose={() => setGen(false)}>
          <GeneratorPanel
            onUse={(v) => {
              set({ password: v });
              setShowPw(true);
              setGen(false);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
