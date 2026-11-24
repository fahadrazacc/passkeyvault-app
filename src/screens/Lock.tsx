import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import type { AppData } from '../types';
import { createVault, getMeta, hasVault, installBackup, noteFailedUnlock, noteGoodUnlock, openVault, setMeta, wipeVault, type Session } from '../vault';
import { BioName, bioName, biometricAvailable, biometricEnabled, disableBiometric, enableBiometric, pickFile, unlockWithBiometric } from '../platform';
import { ask } from '../confirm';
import { emptyData } from '../utils';
import { estimate } from '../strength';
import { StrengthBar } from '../ui';

export function Lock({ onOpen }: { onOpen: (s: Session, d: AppData) => void }) {
  const [mode, setMode] = useState<'unlock' | 'welcome' | 'setup'>(hasVault() ? 'unlock' : 'welcome');
  if (mode === 'unlock') return <Unlock onOpen={onOpen} onReset={() => setMode('welcome')} />;
  if (mode === 'setup') return <Setup onOpen={onOpen} onBack={() => setMode('welcome')} />;
  return <Welcome onCreate={() => setMode('setup')} onRestored={() => setMode('unlock')} />;
}

export function Logo({ size = 96 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size, borderRadius: size * 0.31 }} aria-hidden="true">
      <svg width={size / 2} height={size / 2} viewBox="0 0 48 48" fill="none">
        <path d="M24 5 9 11v11c0 10 6.5 17 15 20 8.5-3 15-10 15-20V11L24 5z" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="24" cy="21" r="5" stroke="var(--ink)" strokeWidth="3" />
        <path d="M24 26v8M24 30h4" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Welcome({ onCreate, onRestored }: { onCreate: () => void; onRestored: () => void }) {
  const [error, setError] = useState('');
  const restore = async () => {
    setError('');
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      installBackup(f.text);
      onRestored();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="lock">
      <div className="lock-top">
        <Logo />
        <h1 className="lock-title">PassKey Vault</h1>
        <p className="lock-sub">All your passwords, cards and notes in one encrypted vault, on web, Android and iPhone.</p>
      </div>
      <ul className="welcome-list">
        <li>
          <Icon name="lock" size={18} />
          <span>Encrypted on your device with AES-256. Only your master password opens it.</span>
        </li>
        <li>
          <Icon name="shield" size={18} />
          <span>Spots weak, reused and breached passwords.</span>
        </li>
        <li>
          <Icon name="clock" size={18} />
          <span>Built-in two-factor codes, so you don't need a separate authenticator app.</span>
        </li>
        <li>
          <Icon name="upload" size={18} />
          <span>Moving over? Import from LastPass, Chrome, Apple Passwords or Bitwarden.</span>
        </li>
      </ul>
      <div className="lock-actions">
        <button className="btn primary" onClick={onCreate}>
          Create my vault
        </button>
        <button className="btn ghost" onClick={restore}>
          Restore from a backup file
        </button>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
      </div>
    </main>
  );
}

function Setup({ onOpen, onBack }: { onOpen: (s: Session, d: AppData) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [hint, setHint] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'bio'>('form');
  const opened = useRef<{ s: Session; d: AppData } | null>(null);
  const s = estimate(pass);

  const submit = async () => {
    setError('');
    if (pass.length < 10) return setError('Use at least 10 characters. A few random words works well.');
    if (s.level < 2) return setError('That password is too easy to guess. Make it longer or less predictable.');
    if (pass !== pass2) return setError("The two passwords don't match");
    if (hint && pass.toLowerCase().includes(hint.toLowerCase())) return setError("The hint can't contain the password");
    setBusy(true);
    const data = emptyData(name.trim());
    const session = await createVault(pass, data);
    setMeta({ hint: hint.trim() || undefined });
    opened.current = { s: session, d: data };
    setBusy(false);
    if (await biometricAvailable()) setStep('bio');
    else onOpen(session, data);
  };

  if (step === 'bio')
    return (
      <main className="lock">
        <div className="lock-top">
          <span className="logo" style={{ width: 96, height: 96, borderRadius: 30, color: 'var(--accent)' }}>
            <Icon name={bioName() === 'Face ID' ? 'face' : 'finger'} size={48} stroke={1.5} />
          </span>
          <h1 className="lock-title">Unlock with {bioName()}?</h1>
          <p className="lock-sub">Open your vault with {bioName()} instead of typing your master password every time. You can change this later in Settings.</p>
        </div>
        <div className="lock-actions">
          <button
            className="btn primary"
            onClick={async () => {
              try {
                await enableBiometric(pass);
              } catch {
                /* cancelled */
              }
              onOpen(opened.current!.s, opened.current!.d);
            }}
          >
            Turn on {bioName()}
          </button>
          <button className="btn ghost" onClick={() => onOpen(opened.current!.s, opened.current!.d)}>
            Not now
          </button>
        </div>
      </main>
    );

  return (
    <main className="lock">
      <button className="btn-icon lock-back" onClick={onBack} aria-label="Back">
        <Icon name="chevL" />
      </button>
      <div className="lock-top" style={{ paddingTop: 24 }}>
        <h1 className="lock-title">Create your master password</h1>
        <p className="lock-sub">This is the one password you'll need to remember. It encrypts your whole vault and can't be recovered if you forget it.</p>
      </div>
      <form
        className="stack"
        style={{ width: '100%' }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <label htmlFor="s-name">Your name (optional)</label>
          <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="s-pass">Master password</label>
          <div className="input-wrap">
            <input id="s-pass" className="input" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" autoFocus />
            <button type="button" className="btn-icon in" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
          {pass && (
            <>
              <StrengthBar password={pass} />
              <span className="muted small">Would take {s.crack} to crack.</span>
            </>
          )}
        </div>
        <div className="field">
          <label htmlFor="s-pass2">Type it again</label>
          <input id="s-pass2" className="input" type={show ? 'text' : 'password'} value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="s-hint">Hint (optional, shown on the lock screen)</label>
          <input id="s-hint" className="input" value={hint} onChange={(e) => setHint(e.target.value)} maxLength={80} />
        </div>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Encrypting…' : 'Create vault'}
        </button>
      </form>
    </main>
  );
}

function Unlock({ onOpen, onReset }: { onOpen: (s: Session, d: AppData) => void; onReset: () => void }) {
  const meta = getMeta();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [bio] = useState(biometricEnabled);
  const [wait, setWait] = useState(() => Math.max(0, (meta.lockedUntil ?? 0) - Date.now()));
  const [showHint, setShowHint] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait(Math.max(0, (getMeta().lockedUntil ?? 0) - Date.now())), 500);
    return () => clearInterval(t);
  }, [wait]);

  const tryOpen = useCallback(
    async (p: string) => {
      setBusy(true);
      try {
        const { session, data } = await openVault(p);
        noteGoodUnlock();
        onOpen(session, data);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === 'Wrong password') {
          const w = noteFailedUnlock();
          setWait(w);
          setError('Wrong master password');
        } else setError(msg);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPass('');
      } finally {
        setBusy(false);
      }
    },
    [onOpen],
  );

  const biometric = useCallback(async () => {
    setError('');
    try {
      await tryOpen(await unlockWithBiometric());
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/no protected credentials|invalidated|21/i.test(msg)) {
        await disableBiometric();
        setError(`${BioName()} changed on this device. Unlock with your master password, then turn ${bioName()} on again in Settings.`);
      } else if (!/cancel/i.test(msg)) setError(`${BioName()} not recognised. Use your master password.`);
    }
  }, [tryOpen]);

  useEffect(() => {
    if (bio && !tried.current) {
      tried.current = true;
      biometric();
    }
  }, [bio, biometric]);

  const forgot = async () => {
    if (
      !(await ask(
        "Your vault is encrypted with your master password, so nobody (including us) can open or reset it without it. You can erase this vault and start again, or restore an older backup if you remember that backup's password.",
        { ok: 'Erase vault' },
      ))
    )
      return;
    if (!(await ask('This permanently deletes every item in the vault on this device. Are you sure?', { ok: 'Yes, erase everything' }))) return;
    wipeVault();
    await disableBiometric();
    onReset();
  };

  return (
    <main className="lock">
      <div className="lock-top" style={{ paddingTop: 40 }}>
        <Logo />
        <h1 className="lock-title">PassKey Vault</h1>
        <p className="lock-sub">Your vault is locked and encrypted on this device.</p>
      </div>
      {bio && (
        <div className="bio-wrap">
          <button className="bio-btn" onClick={biometric} aria-label={`Unlock with ${bioName()}`} disabled={busy || wait > 0}>
            <Icon name={bioName() === 'Face ID' ? 'face' : 'finger'} size={52} stroke={1.5} />
          </button>
          <span className="muted">Tap to unlock with {bioName()}</span>
        </div>
      )}
      <form
        className={`stack ${shake ? 'shake' : ''}`}
        style={{ width: '100%', marginTop: 'auto' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (pass && !busy && wait <= 0) tryOpen(pass);
        }}
      >
        <div className="field">
          <label htmlFor="u-pass">Master password</label>
          <div className="input-wrap">
            <input
              id="u-pass"
              className="input"
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError('');
              }}
              autoComplete="current-password"
              autoFocus={!bio}
              disabled={wait > 0}
            />
            <button type="button" className="btn-icon in" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
        </div>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        {wait > 0 && (
          <span className="error" role="status">
            Too many wrong tries. Try again in {Math.ceil(wait / 1000)}s.
          </span>
        )}
        <button className="btn primary" disabled={busy || !pass || wait > 0}>
          {busy ? 'Unlocking…' : 'Unlock vault'}
        </button>
        <div className="row-between">
          {meta.hint ? (
            <button type="button" className="link-btn" onClick={() => setShowHint(!showHint)}>
              {showHint ? `Hint: ${meta.hint}` : 'Show hint'}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="link-btn" onClick={forgot}>
            Forgot password?
          </button>
        </div>
      </form>
      <p className="lock-foot">
        <Icon name="lock" size={14} /> Zero-knowledge · AES-256 · encrypted on your device
      </p>
    </main>
  );
}
