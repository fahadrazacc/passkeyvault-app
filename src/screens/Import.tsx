import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { go } from '../router';
import { BackLink, Header, Toggle } from '../ui';
import { importCsv, type ImportResult } from '../importer';
import { openBackup } from '../vault';
import { pickFile } from '../platform';
import { toast } from '../toast';
import type { Item } from '../types';
import { normalize } from '../utils';

const HOWTO: { name: string; steps: string }[] = [
  { name: 'LastPass', steps: 'On the LastPass website: Advanced options → Export → LastPass CSV file. Enter your LastPass master password and save the file.' },
  { name: 'Chrome / Edge / Brave', steps: 'Settings → Passwords (Password Manager) → Settings → Export passwords.' },
  { name: 'Apple Passwords / Safari', steps: 'Passwords app on Mac: File → Export All Passwords. On iPhone 18+: Passwords → ⋯ → Export.' },
  { name: 'Bitwarden', steps: 'Tools → Export vault → File format .csv.' },
  { name: '1Password', steps: 'File → Export → choose CSV.' },
];

const key = (i: Item) => [i.type, i.title.toLowerCase(), (i.username ?? '').toLowerCase(), i.password ?? '', i.cardNumber ?? '', i.notes ?? ''].join('\u0000');

export function Import() {
  const { data, update } = useStore();
  const [res, setRes] = useState<(ImportResult & { dupes: number; file: string }) | null>(null);
  const [backup, setBackup] = useState<{ text: string; file: string } | null>(null);
  const [bpass, setBpass] = useState('');
  const [skipDupes, setSkipDupes] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>('LastPass');

  const existing = new Set(data.items.map(key));

  const choose = async () => {
    setError('');
    setRes(null);
    setBackup(null);
    const f = await pickFile('.csv,.json,text/csv,application/json');
    if (!f) return;
    if (/\.json$/i.test(f.name) || f.text.trimStart().startsWith('{')) {
      setBackup({ text: f.text, file: f.name });
      return;
    }
    try {
      const r = importCsv(f.text);
      setRes({ ...r, dupes: r.items.filter((i) => existing.has(key(i))).length, file: f.name });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const add = (items: Item[], source: string) => {
    const fresh = skipDupes ? items.filter((i) => !existing.has(key(i))) : items;
    const ids = new Set(data.items.map((i) => i.id));
    const safe = fresh.map((i) => (ids.has(i.id) ? { ...i, id: crypto.randomUUID().replace(/-/g, '').slice(0, 16) } : i));
    const folders = [...new Set(safe.map((i) => i.folder).filter(Boolean) as string[])];
    update((d) => ({ ...d, items: [...d.items, ...safe], folders: [...new Set([...d.folders, ...folders])] }));
    toast(`Imported ${safe.length} item${safe.length === 1 ? '' : 's'} from ${source}`);
    go('vault');
  };

  const openBk = async () => {
    setError('');
    try {
      const { data: other } = await openBackup(backup!.text, bpass);
      add(normalize(other).items, 'backup');
    } catch (e) {
      setError((e as Error).message === 'Wrong password' ? "That isn't the password for this backup" : (e as Error).message);
    }
  };

  return (
    <div className="page narrow">
      <Header title="Import passwords" left={<BackLink to="settings" />} />
      <div className="card form-card">
        <p style={{ margin: 0, lineHeight: 1.5 }}>Export your passwords from your old app as a CSV file, then choose it here. Everything is read on this device and nothing is uploaded.</p>
        <button className="btn primary" onClick={choose}>
          <Icon name="upload" size={18} /> Choose a file
        </button>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
      </div>

      {res && (
        <div className="card form-card">
          <span className="row-title">
            Found {res.items.length} item{res.items.length === 1 ? '' : 's'} in {res.file}
          </span>
          <span className="muted small">
            Looks like a {res.source} export.
            {res.skipped ? ` ${res.skipped} empty rows skipped.` : ''}
            {res.dupes ? ` ${res.dupes} already in your vault.` : ''}
          </span>
          <div className="card list" style={{ background: 'transparent' }}>
            {res.dupes > 0 && <Toggle label="Skip items I already have" checked={skipDupes} onChange={setSkipDupes} />}
          </div>
          <button className="btn primary" onClick={() => add(res.items, res.source)}>
            Import {skipDupes ? res.items.length - res.dupes : res.items.length} items
          </button>
          <span className="warn-text small">After importing, delete the CSV file: it isn't encrypted.</span>
        </div>
      )}

      {backup && (
        <form
          className="card form-card"
          onSubmit={(e) => {
            e.preventDefault();
            openBk();
          }}
        >
          <span className="row-title">PassKey Vault backup: {backup.file}</span>
          <div className="field">
            <label htmlFor="bk-pass">The master password this backup was made with</label>
            <input id="bk-pass" className="input" type="password" value={bpass} onChange={(e) => setBpass(e.target.value)} autoFocus />
          </div>
          <button className="btn primary" disabled={!bpass}>
            Add items from backup
          </button>
        </form>
      )}

      <section className="section">
        <h2 className="label">How to export from…</h2>
        <div className="card list">
          {HOWTO.map((h) => (
            <div key={h.name} className="row col">
              <button className="howto-head" onClick={() => setOpen(open === h.name ? null : h.name)} aria-expanded={open === h.name}>
                <span className="row-title">{h.name}</span>
                <Icon name={open === h.name ? 'chevD' : 'chevR'} size={18} />
              </button>
              {open === h.name && <p className="muted small howto-body">{h.steps}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
