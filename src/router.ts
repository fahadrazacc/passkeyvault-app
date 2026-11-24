import { useEffect, useState } from 'react';

export type Path = 'vault' | 'item' | 'edit' | 'generator' | 'security' | 'settings' | 'import';

// Normal builds route on the URL hash (#/records), so the Android back button and browser history work.
// The single-file preview build keeps the route in memory, because its host frame doesn't allow #/paths.
const MEMORY = false;
let memRoute = '';
const listeners = new Set<() => void>();

function current() {
  return MEMORY ? memRoute : location.hash.replace(/^#\/?/, '');
}

function parse() {
  const [path, q = ''] = current().split('?');
  return { path: ((path as Path) || 'vault') as Path, params: new URLSearchParams(q) };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    if (MEMORY) {
      listeners.add(f);
      // intercept in-app links
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a');
        const h = a?.getAttribute('href');
        if (h && h.startsWith('#/')) {
          e.preventDefault();
          go(h.slice(2));
        }
      };
      document.addEventListener('click', onClick);
      return () => {
        listeners.delete(f);
        document.removeEventListener('click', onClick);
      };
    }
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const go = (p: string) => {
  if (MEMORY) {
    memRoute = p;
    listeners.forEach((f) => f());
  } else location.hash = '#/' + p;
};
export const href = (p: string) => '#/' + p;
