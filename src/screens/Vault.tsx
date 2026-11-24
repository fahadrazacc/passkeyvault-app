import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { go, href } from '../router';
import { Badge, Empty, Header, ItemTile, useWide } from '../ui';
import type { Item, ItemType } from '../types';
import { matches, subtitle, TYPE_PLURAL } from '../utils';
import { report } from '../security';
import { ItemDetail } from './ItemDetail';

export type Filter = 'all' | 'fav' | ItemType | `folder:${string}`;

export function filterLabel(f: Filter) {
  if (f === 'all') return 'All items';
  if (f === 'fav') return 'Favorites';
  if (f.startsWith('folder:')) return f.slice(7);
  return TYPE_PLURAL[f as ItemType];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Vault({ filter, selected }: { filter: Filter; selected?: string | null }) {
  const { data, lock } = useStore();
  const wide = useWide();
  const [q, setQ] = useState('');
  const health = useMemo(() => report(data), [data]);
  const problems = health.problems;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.items.length, fav: data.items.filter((i) => i.favorite).length };
    for (const i of data.items) c[i.type] = (c[i.type] ?? 0) + 1;
    return c;
  }, [data.items]);

  const list = useMemo(() => {
    let items = data.items.filter((i) => matches(i, q));
    if (filter === 'fav') items = items.filter((i) => i.favorite);
    else if (filter.startsWith('folder:')) items = items.filter((i) => i.folder === filter.slice(7));
    else if (filter !== 'all') items = items.filter((i) => i.type === filter);
    return items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }, [data.items, q, filter]);

  const recent = useMemo(
    () =>
      [...data.items]
        .filter((i) => i.usedAt)
        .sort((a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0))
        .slice(0, 4),
    [data.items],
  );

  // A–Z sections
  const sections = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of list) {
      const k = /[a-z]/i.test(i.title[0] ?? '') ? i.title[0].toUpperCase() : '#';
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()];
  }, [list]);

  const flags = (i: Item) => {
    const out: { tone: 'good' | 'bad' | 'warn' | 'accent'; text: string }[] = [];
    if ((data.breaches[i.id]?.count ?? 0) > 0) out.push({ tone: 'bad', text: 'Breached' });
    else if (health.reused.some((g) => g.includes(i))) out.push({ tone: 'warn', text: 'Reused' });
    else if (health.weak.includes(i)) out.push({ tone: 'warn', text: 'Weak' });
    if (i.totp) out.push({ tone: 'accent', text: '2FA' });
    return out.slice(0, 2);
  };

  const row = (i: Item) => (
    <a key={i.id} className={`row item-row ${selected === i.id ? 'sel' : ''}`} href={href(`item?id=${i.id}${filter !== 'all' ? '&f=' + encodeURIComponent(filter) : ''}`)}>
      <ItemTile item={i} />
      <span className="row-main">
        <span className="row-title">
          {i.title}
          {i.favorite && (
            <span className="fav-dot" aria-label="Favorite">
              <Icon name="star" size={12} fill="currentColor" stroke={0} />
            </span>
          )}
        </span>
        <span className="row-sub">{subtitle(i)}</span>
      </span>
      {flags(i).map((f) => (
        <Badge key={f.text} tone={f.tone}>
          {f.text}
        </Badge>
      ))}
    </a>
  );

  const chips: Filter[] = ['all', 'fav', 'login', 'card', 'note', 'wifi', 'identity'];
  const listPane = (
    <div className="page vault-list">
      {!wide && (
        <Header
          big
          sub={data.settings.name ? `${greeting()}, ${data.settings.name.split(' ')[0]}` : greeting()}
          title="Vault"
          right={
            <button className="btn-icon" onClick={lock} aria-label="Lock vault">
              <Icon name="lock" />
            </button>
          }
        />
      )}
      {wide && <h1 className="pane-title">{filterLabel(filter)}</h1>}
      <label className="search">
        <Icon name="search" size={18} />
        <input placeholder={`Search ${data.items.length} items`} aria-label="Search vault" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </label>
      {!wide && (
        <div className="chips" role="tablist" aria-label="Show">
          {chips
            .filter((c) => c === 'all' || counts[c])
            .map((c) => (
              <button key={c} role="tab" aria-selected={filter === c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => go(c === 'all' ? 'vault' : `vault?f=${c}`)}>
                {filterLabel(c).replace('All items', 'All')} {counts[c] ?? 0}
              </button>
            ))}
        </div>
      )}
      {problems > 0 && filter === 'all' && !q && (
        <a className="banner warn" href={href('security')}>
          <span className="banner-icon">
            <Icon name="alert" size={20} />
          </span>
          <span className="row-main">
            <span className="row-title">
              {problems} password{problems === 1 ? ' needs' : 's need'} attention
            </span>
            <span className="row-sub">
              {[health.breached.length && `${health.breached.length} breached`, health.reusedCount && `${health.reusedCount} reused`, health.weak.length && `${health.weak.length} weak`].filter(Boolean).join(' · ')}
            </span>
          </span>
          <Icon name="chevR" size={18} />
        </a>
      )}
      {data.items.length === 0 ? (
        <Empty
          icon="key"
          title="Your vault is empty"
          text="Add your first password, or bring everything over from LastPass or your browser."
          action={
            <div className="stack" style={{ width: '100%', maxWidth: 280 }}>
              <a className="btn primary" href={href('edit?type=login')}>
                Add a password
              </a>
              <a className="btn secondary" href={href('import')}>
                Import passwords
              </a>
            </div>
          }
        />
      ) : list.length === 0 ? (
        <Empty icon="search" title="Nothing found" text={q ? `No items match "${q}".` : 'Nothing here yet.'} />
      ) : (
        <>
          {!q && filter === 'all' && recent.length > 0 && (
            <section className="section">
              <h2 className="label">Recently used</h2>
              <div className="card list">{recent.map(row)}</div>
            </section>
          )}
          {sections.map(([letter, items]) => (
            <section className="section" key={letter}>
              <h2 className="label">{letter}</h2>
              <div className="card list">{items.map(row)}</div>
            </section>
          ))}
        </>
      )}
      {!wide && (
        <a className="fab" href={href('edit?type=login')} aria-label="Add item">
          <Icon name="plus" size={26} stroke={2.4} />
        </a>
      )}
    </div>
  );

  if (!wide) return listPane;
  return (
    <div className="split">
      {listPane}
      <div className="detail-pane">
        {selected && data.items.some((i) => i.id === selected) ? (
          <ItemDetail key={selected} id={selected} embedded back={filter === 'all' ? 'vault' : `vault?f=${filter}`} />
        ) : (
          <Empty icon="vault" title="Select an item" text="Pick something from the list to see its details." />
        )}
      </div>
    </div>
  );
}
