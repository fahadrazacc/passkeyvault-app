import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Icon, type IconName } from '../icons';
import { href } from '../router';
import { Header, Segmented, Sheet, Toggle } from '../ui';
import { ask } from '../confirm';
import { toast } from '../toast';
import { changePassword, checkPassword, exportBackup, getMeta, setMeta, wipeVault } from '../vault';
import { BioName, bioName, biometricAvailable, biometricEnabled, disableBiometric, enableBiometric, refreshBiometric, saveFile, stamp } from '../platform';
import { estimate } from '../strength';
import { StrengthBar } from '../ui';
import { exportCsv } from '../importer';

export function Settings() {
  const { data, update, session, setSession, lock } = useStore();
  const s = data.settings;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const [bioOk, setBioOk] = useState(false);
  const [bioOn, setBioOn] = useState(biometricEnabled);
  const [changing, setChanging] = useState(false);
  const [askBio, setAskBio] = useState(false);
  useEffect(() => {
    biometricAvailable().then(setBioOk);
  }, []);

  const toggleBio = async (on: boolean) => {
    if (!on) {
      await disableBiometric();
      setBioOn(false);
      return;
    }
    setAskBio(true);
  };

  const backup = async () => {
    const text = exportBackup();
    if (!text) return;
    await saveFile(`passkeyvault-backup-${stamp()}.json`, text);
    toast('Backup saved. It opens only with your master password.');
  };

  const csv = async () => {
    if (!(await ask('This saves every password in a plain, unencrypted file that anyone with the file can read. Only do this to move to another app, and delete the file afterwards.', { ok: 'Export', verify: true }))) return;
    await saveFile(`passkeyvault-export-${stamp()}.csv`, exportCsv(data.items), 'text/csv');
  };

  const erase = async () => {
    if (!(await ask('Erase the vault on this device? Every item is deleted. Save a backup first if you might need them.', { ok: 'Erase everything', verify: true }))) return;
    wipeVault();
    await disableBiometric();
    lock();
  };

  return (
    <div className="page narrow">
      <Header big title="Settings" />

      <Group title="Security">
        <div className="row">
          <span className="row-main">
            <span className="row-title">Auto-lock</span>
            <span className="row-sub">When the app is in the background or idle</span>
          </span>
          <select className="input select" aria-label="Auto-lock" value={s.autoLockMin} onChange={(e) => set({ autoLockMin: Number(e.target.value) })}>
            <option value={0}>Immediately</option>
            <option value={1}>After 1 minute</option>
            <option value={5}>After 5 minutes</option>
            <option value={15}>After 15 minutes</option>
            <option value={60}>After 1 hour</option>
          </select>
        </div>
        <div className="row">
          <span className="row-main">
            <span className="row-title">Clear clipboard</span>
            <span className="row-sub">After copying a password or code</span>
          </span>
          <select className="input select" aria-label="Clear clipboard" value={s.clipboardClearSec} onChange={(e) => set({ clipboardClearSec: Number(e.target.value) })}>
            <option value={15}>After 15 seconds</option>
            <option value={30}>After 30 seconds</option>
            <option value={60}>After 1 minute</option>
            <option value={0}>Never</option>
          </select>
        </div>
        {bioOk && <Toggle label={`Unlock with ${bioName()}`} sub="Your master password is kept in the phone's secure hardware" checked={bioOn} onChange={toggleBio} />}
        <Link icon="key" label="Change master password" onClick={() => setChanging(true)} />
        <Link icon="lock" label="Lock now" onClick={lock} />
      </Group>

      <Group title="Appearance">
        <div className="row col">
          <Segmented
            label="Theme"
            value={s.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="row">
          <label className="row-main" htmlFor="set-name">
            <span className="row-title">Your name</span>
          </label>
          <input id="set-name" className="input" style={{ maxWidth: 200 }} value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
      </Group>

      <Group title="Your data">
        <Link icon="upload" label="Import passwords" sub="From LastPass, Chrome, Apple Passwords, Bitwarden, 1Password or a PassKey Vault backup" to="import" />
        <Link icon="download" label="Save encrypted backup" sub="A file that only your master password opens" onClick={backup} />
        <Link icon="note" label="Export as CSV" sub="Unencrypted, for moving to another app" onClick={csv} />
        <Link icon="trash" label="Erase vault on this device" danger onClick={erase} />
      </Group>

      <p className="about">
        PassKey Vault {__APP_VERSION__}
        <br />
        Your vault is encrypted on this device with AES-256-GCM. The key comes from your master password (PBKDF2-SHA256, 600,000 rounds) and is never stored or sent anywhere.
      </p>

      {changing && <ChangePassword onClose={() => setChanging(false)} onDone={(sess, pass) => {
        setSession(sess);
        refreshBiometric(pass);
        setChanging(false);
        toast('Master password changed');
      }} data={data} oldSession={session} />}
      {askBio && (
        <ConfirmMaster
          title={`Turn on ${bioName()}`}
          onClose={() => setAskBio(false)}
          onOk={async (pass) => {
            try {
              await enableBiometric(pass);
              setBioOn(true);
              toast(`${BioName()} unlock is on`);
            } catch {
              toast(`${BioName()} wasn't turned on`);
            }
            setAskBio(false);
          }}
        />
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="label">{title}</h2>
      <div className="card list">{children}</div>
    </section>
  );
}

function Link({ icon, label, sub, to, onClick, danger }: { icon: IconName; label: string; sub?: string; to?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className={`set-icon ${danger ? 'danger' : ''}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="row-main">
        <span className="row-title" style={danger ? { color: 'var(--bad)' } : undefined}>
          {label}
        </span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <Icon name="chevR" size={18} />
    </>
  );
  return to ? (
    <a className="row link-row" href={href(to)}>
      {inner}
    </a>
  ) : (
    <button className="row link-row" onClick={onClick}>
      {inner}
    </button>
  );
}

function ConfirmMaster({ title, onClose, onOk }: { title: string; onClose: () => void; onOk: (pass: string) => void }) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await checkPassword(pass)) onOk(pass);
          else setError("That password isn't right");
        }}
      >
        <div className="field">
          <label htmlFor="cm-pass">Master password</label>
          <input id="cm-pass" className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete="current-password" />
        </div>
        {error && <span className="error">{error}</span>}
        <button className="btn primary">Continue</button>
      </form>
    </Sheet>
  );
}

function ChangePassword({ onClose, onDone, data }: { onClose: () => void; onDone: (s: import('../vault').Session, pass: string) => void; data: import('../types').AppData; oldSession: import('../vault').Session }) {
  const [old, setOld] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [hint, setHint] = useState(getMeta().hint ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Change master password" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (!(await checkPassword(old))) return setError('Your current password is wrong');
          if (pass.length < 10 || estimate(pass).level < 2) return setError('Choose a longer, harder-to-guess password (at least 10 characters)');
          if (pass !== pass2) return setError("The new passwords don't match");
          if (hint && pass.toLowerCase().includes(hint.toLowerCase())) return setError("The hint can't contain the password");
          setBusy(true);
          const s = await changePassword(pass, data);
          setMeta({ hint: hint.trim() || undefined });
          setBusy(false);
          onDone(s, pass);
        }}
      >
        <div className="field">
          <label htmlFor="cp-old">Current master password</label>
          <input id="cp-old" className="input" type="password" value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="cp-new">New master password</label>
          <input id="cp-new" className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
          {pass && <StrengthBar password={pass} />}
        </div>
        <div className="field">
          <label htmlFor="cp-new2">Type it again</label>
          <input id="cp-new2" className="input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="cp-hint">Hint (optional)</label>
          <input id="cp-hint" className="input" value={hint} onChange={(e) => setHint(e.target.value)} maxLength={80} />
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Backups you saved before keep their old password.
        </p>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Re-encrypting…' : 'Change password'}
        </button>
      </form>
    </Sheet>
  );
}
