import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { href } from '../router';
import { Empty, Header, ItemTile } from '../ui';
import { checkBreaches, OLD_DAYS, report } from '../security';
import type { Item } from '../types';
import { ago } from '../utils';
import { toast } from '../toast';
import { ask } from '../confirm';

type Tab = 'breached' | 'reused' | 'weak' | 'old' | 'no2fa';

export function Security() {
  const { data, update } = useStore();
  const r = useMemo(() => report(data), [data]);
  const [tab, setTab] = useState<Tab>(r.breached.length ? 'breached' : r.reused.length ? 'reused' : r.weak.length ? 'weak' : 'old');
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const runCheck = async () => {
    if (
      !data.breachCheckedAt &&
      !(await ask(
        "PassKey Vault will check your passwords against Have I Been Pwned's list of leaked passwords. Only the first 5 characters of each password's SHA-1 fingerprint are sent, so your passwords never leave this device.",
        { ok: 'Check now', danger: false },
      ))
    )
      return;
    setProgress([0, r.checked]);
    try {
      const breaches = await checkBreaches(data, (d, t) => setProgress([d, t]));
      update((d) => ({ ...d, breaches, breachCheckedAt: Date.now() }));
      const found = Object.values(breaches).filter((b) => b.count > 0).length;
      toast(found ? `${found} breached password${found === 1 ? '' : 's'} found` : 'No breached passwords found');
      if (found) setTab('breached');
    } catch (e) {
      toast((e as Error).message || 'Check failed. Are you online?');
    } finally {
      setProgress(null);
    }
  };

  const tone = r.score >= 90 ? 'Excellent' : r.score >= 75 ? 'Good, not great' : r.score >= 50 ? 'Needs work' : 'At risk';
  const ring = r.score >= 75 ? 'var(--accent)' : r.score >= 50 ? 'var(--warn)' : 'var(--bad)';
  const C = 2 * Math.PI * 46;

  const itemRow = (i: Item, extra: ReactNode) => (
    <a key={i.id} className="row item-row" href={href(`edit?id=${i.id}&back=security`)}>
      <ItemTile item={i} size={36} />
      <span className="row-main">
        <span className="row-title">{i.title}</span>
        <span className="row-sub">{extra}</span>
      </span>
      <span className="btn secondary small-btn">Fix</span>
    </a>
  );

  let body: ReactNode = null;
  if (tab === 'breached')
    body = r.breached.length ? (
      r.breached.map((i) => itemRow(i, `Seen ${data.breaches[i.id].count.toLocaleString()} times in leaks`))
    ) : (
      <Empty icon="shield" title={data.breachCheckedAt ? 'No breached passwords' : 'Not checked yet'} text={data.breachCheckedAt ? `Last checked ${ago(data.breachCheckedAt)}.` : 'Run a breach check to look for leaked passwords.'} />
    );
  if (tab === 'reused')
    body = r.reused.length ? (
      r.reused.map((g, n) => (
        <div key={n} className="reuse-group">
          <span className="label">Used on {g.length} sites</span>
          {g.map((i) => itemRow(i, i.username || ''))}
        </div>
      ))
    ) : (
      <Empty icon="check" title="No reused passwords" text="Every item has its own password." />
    );
  if (tab === 'weak') body = r.weak.length ? r.weak.map((i) => itemRow(i, 'Easy to guess')) : <Empty icon="check" title="No weak passwords" text="Nice work." />;
  if (tab === 'old') body = r.old.length ? r.old.map((i) => itemRow(i, `Not changed since ${new Date(i.passwordChangedAt ?? i.createdAt).getFullYear()}`)) : <Empty icon="check" title="Nothing old" text={`All passwords were changed in the last ${OLD_DAYS / 365} year.`} />;
  if (tab === 'no2fa') body = r.no2fa.length ? r.no2fa.map((i) => itemRow(i, 'Add a two-factor key if the site offers it')) : <Empty icon="check" title="All covered" text="Every login has two-factor codes." />;

  const tiles: { t: Tab; n: number; label: string; cls: string }[] = [
    { t: 'breached', n: r.breached.length, label: 'Breached', cls: 'bad' },
    { t: 'reused', n: r.reusedCount, label: 'Reused', cls: 'warn' },
    { t: 'weak', n: r.weak.length, label: 'Weak', cls: '' },
    { t: 'old', n: r.old.length, label: 'Over a year old', cls: '' },
  ];

  return (
    <div className="page narrow">
      <Header big title="Security" />
      {r.checked === 0 ? (
        <Empty icon="shield" title="Nothing to check yet" text="Add some logins and PassKey Vault will look for weak, reused and breached passwords." />
      ) : (
        <>
          <div className="card score-card">
            <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Security score ${r.score} out of 100`}>
              <circle cx="56" cy="56" r="46" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle cx="56" cy="56" r="46" fill="none" stroke={ring} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(C * r.score) / 100} ${C}`} transform="rotate(-90 56 56)" />
              <text x="56" y="62" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--ink)" fontFamily="Space Grotesk, sans-serif">
                {r.score}
              </text>
              <text x="56" y="80" textAnchor="middle" fontSize="11" fill="var(--muted)">
                of 100
              </text>
            </svg>
            <div className="row-main" style={{ gap: 6 }}>
              <span className="score-tone">{tone}</span>
              <span className="muted small" style={{ lineHeight: 1.45 }}>
                {r.checked} passwords checked.{' '}
                {data.breachCheckedAt ? `Breach check ${ago(data.breachCheckedAt)}.` : 'Breach check not run yet.'}
              </span>
              <button className="btn secondary small-btn" style={{ alignSelf: 'flex-start' }} onClick={runCheck} disabled={!!progress}>
                {progress ? `Checking ${progress[0]}/${progress[1]}…` : data.breachCheckedAt ? 'Check again' : 'Check for breaches'}
              </button>
            </div>
          </div>
          <div className="stat-grid">
            {tiles.map((x) => (
              <button key={x.t} className={`stat ${x.cls} ${x.n ? '' : 'zero'} ${tab === x.t ? 'on' : ''}`} onClick={() => setTab(x.t)} aria-pressed={tab === x.t}>
                <span className="stat-n">{x.n}</span>
                <span className="stat-l">{x.label}</span>
              </button>
            ))}
          </div>
          <button className={`row card no2fa-row ${tab === 'no2fa' ? 'on' : ''}`} onClick={() => setTab('no2fa')} aria-pressed={tab === 'no2fa'}>
            <Icon name="clock" size={20} />
            <span className="row-main">
              <span className="row-title">{r.no2fa.length} logins without two-factor codes</span>
              <span className="row-sub">Two-factor stops most account takeovers</span>
            </span>
            <Icon name="chevR" size={18} />
          </button>
          <section className="section">
            <h2 className="label">{tab === 'no2fa' ? 'Without two-factor' : tiles.find((x) => x.t === tab)!.label}</h2>
            <div className="card list">{body}</div>
          </section>
        </>
      )}
    </div>
  );
}
