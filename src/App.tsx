import { useCallback, useMemo, useState } from 'react';
import { Icon, type IconName } from './icons';
import { StoreProvider, useStore } from './store';
import { href, useRoute, type Path } from './router';
import type { AppData, ItemType } from './types';
import type { Session } from './vault';
import { Lock, Logo } from './screens/Lock';
import { ConfirmHost } from './confirm';
import { ToastHost } from './toast';
import { normalize } from './utils';
import { useWide } from './ui';
import { filterLabel, Vault, type Filter } from './screens/Vault';
import { ItemDetail } from './screens/ItemDetail';
import { EditItem } from './screens/EditItem';
import { Generator } from './screens/Generator';
import { Security } from './screens/Security';
import { Settings } from './screens/Settings';
import { Import } from './screens/Import';
import { report } from './security';

export default function App() {
  const [open, setOpen] = useState<{ session: Session; data: AppData } | null>(null);
  const onOpen = useCallback((session: Session, data: AppData) => setOpen({ session, data: normalize(data) }), []);
  const onLock = useCallback(() => {
    setOpen(null);
    location.hash = '';
  }, []);
  return (
    <>
      {open ? (
        <StoreProvider initial={open.data} session={open.session} onLock={onLock}>
          <Shell />
        </StoreProvider>
      ) : (
        <Lock onOpen={onOpen} />
      )}
      <ConfirmHost />
      <ToastHost />
    </>
  );
}

const TABS: { path: Path; label: string; icon: IconName }[] = [
  { path: 'vault', label: 'Vault', icon: 'vault' },
  { path: 'generator', label: 'Generator', icon: 'dice' },
  { path: 'security', label: 'Security', icon: 'shield' },
  { path: 'settings', label: 'Settings', icon: 'settings' },
];

function Shell() {
  const { path, params } = useRoute();
  const wide = useWide();
  const filter = (params.get('f') || 'all') as Filter;

  let screen;
  switch (path) {
    case 'item':
      screen = wide ? <Vault filter={filter} selected={params.get('id')} /> : <ItemDetail key={params.get('id')} id={params.get('id') ?? ''} back={filter === 'all' ? 'vault' : `vault?f=${filter}`} />;
      break;
    case 'edit':
      screen = <EditItem key={(params.get('id') ?? '') + (params.get('type') ?? '')} id={params.get('id')} presetType={params.get('type') as ItemType | null} back={params.get('back')} />;
      break;
    case 'generator':
      screen = <Generator />;
      break;
    case 'security':
      screen = <Security />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    case 'import':
      screen = <Import />;
      break;
    default:
      screen = <Vault filter={filter} />;
  }
  const active: Path = path === 'item' || path === 'edit' ? 'vault' : path === 'import' ? 'settings' : path;
  const showTabs = wide || path !== 'edit';

  return (
    <div className={wide ? 'shell wide' : `shell ${showTabs ? 'with-tabs' : ''}`}>
      {wide ? <Sidebar active={active} filter={path === 'vault' || path === 'item' ? filter : null} /> : null}
      <main className="main">{screen}</main>
      {!wide && showTabs && (
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.path} className={`tab ${active === t.path ? 'on' : ''}`} href={href(t.path)} aria-current={active === t.path ? 'page' : undefined}>
              <Icon name={t.icon} size={24} stroke={1.8} />
              {t.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

function Sidebar({ active, filter }: { active: Path; filter: Filter | null }) {
  const { data, lock } = useStore();
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.items.length, fav: data.items.filter((i) => i.favorite).length };
    for (const i of data.items) {
      c[i.type] = (c[i.type] ?? 0) + 1;
      if (i.folder) c['folder:' + i.folder] = (c['folder:' + i.folder] ?? 0) + 1;
    }
    return c;
  }, [data.items]);
  const problems = useMemo(() => {
    return report(data).problems;
  }, [data]);
  const folders = [...new Set([...data.folders, ...data.items.map((i) => i.folder).filter(Boolean)])].filter((f) => counts['folder:' + f]).sort() as string[];
  const f = (x: Filter) => (
    <a key={x} className={`side-item ${filter === x ? 'on' : ''}`} href={href(x === 'all' ? 'vault' : `vault?f=${encodeURIComponent(x)}`)}>
      <span>{filterLabel(x)}</span>
      <span className="side-count">{counts[x] ?? 0}</span>
    </a>
  );
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="side-brand">
        <Logo size={34} />
        <span>PassKey Vault</span>
      </div>
      <a className="btn primary side-new" href={href('edit?type=login')}>
        <Icon name="plus" size={18} stroke={2.2} /> New item
      </a>
      {f('all')}
      {(['fav', 'login', 'card', 'note', 'wifi', 'identity'] as Filter[]).filter((x) => counts[x]).map(f)}
      {folders.length > 0 && <span className="side-label">Folders</span>}
      {folders.map((x) => f(`folder:${x}`))}
      <span className="side-label">Tools</span>
      <a className={`side-item ${active === 'security' ? 'on' : ''}`} href={href('security')}>
        <span>Security check</span>
        {problems > 0 && <span className="side-count warn">{problems}</span>}
      </a>
      <a className={`side-item ${active === 'generator' ? 'on' : ''}`} href={href('generator')}>
        <span>Generator</span>
      </a>
      <a className={`side-item ${active === 'settings' ? 'on' : ''}`} href={href('settings')}>
        <span>Settings</span>
      </a>
      <div className="side-foot">
        <button className="btn secondary" onClick={lock}>
          <Icon name="lock" size={18} /> Lock
        </button>
      </div>
    </nav>
  );
}
