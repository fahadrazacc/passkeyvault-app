import { useEffect, useState } from 'react';
import { checkPassword } from './vault';

// In-app replacement for window.confirm. With `verify`, the master password must be entered too.
interface Req {
  message: string;
  ok: string;
  danger: boolean;
  verify: boolean;
  resolve: (v: boolean) => void;
}
let push: ((r: Req) => void) | null = null;

export function ask(message: string, opts: { ok?: string; danger?: boolean; verify?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false);
    push({ message, ok: opts.ok ?? 'Delete', danger: opts.danger ?? true, verify: opts.verify ?? false, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    push = (r) => {
      setPass('');
      setError('');
      setBusy(false);
      setReq(r);
    };
    return () => {
      push = null;
    };
  }, []);
  if (!req) return null;
  const done = (v: boolean) => {
    req.resolve(v);
    setReq(null);
  };
  const confirm = async () => {
    if (!req.verify) return done(true);
    if (!pass) return setError('Enter your master password to continue');
    setBusy(true);
    const ok = await checkPassword(pass);
    setBusy(false);
    if (ok) return done(true);
    setPass('');
    setError("That password isn't right. Try again.");
  };
  return (
    <div className="backdrop center" onClick={() => !busy && done(false)}>
      <div className="card dialog" role="alertdialog" aria-modal="true" aria-label="Please confirm" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-text">{req.message}</p>
        {req.verify && (
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <label htmlFor="confirm-pass">Master password</label>
            <input
              id="confirm-pass"
              className="input"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError('');
              }}
              autoFocus
            />
            {error && (
              <span className="error" role="alert">
                {error}
              </span>
            )}
          </form>
        )}
        <div className="grid2">
          <button className="btn secondary" onClick={() => done(false)} autoFocus={!req.verify} disabled={busy}>
            Cancel
          </button>
          <button className={`btn ${req.danger ? 'danger' : 'primary'}`} onClick={confirm} disabled={busy}>
            {busy ? 'Checking…' : req.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
