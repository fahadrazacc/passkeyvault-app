import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from './types';
import { writeVault, type Session } from './vault';
import { applyTheme } from './theme';

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  lock: () => void;
  session: Session;
  setSession: (s: Session) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider(props: { initial: AppData; session: Session; onLock: () => void; children: ReactNode }) {
  const [data, setData] = useState(props.initial);
  const [session, setSession] = useState(props.session);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const first = useRef(true);

  // Save every change, encrypted, one after another.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saving.current = saving.current.then(() => writeVault(session, data)).catch((e) => console.error('Save failed', e));
  }, [data, session]);

  const theme = data.settings.theme;
  useEffect(() => applyTheme(theme), [theme]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  // Auto-lock: after the chosen time in the background, or that long with no activity on the web.
  const onLock = useRef(props.onLock);
  onLock.current = props.onLock;
  const lockAfter = useRef(1);
  lockAfter.current = data.settings.autoLockMin;
  useEffect(() => {
    let hiddenAt = 0;
    let last = Date.now();
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        if (lockAfter.current === 0) onLock.current();
      } else if (hiddenAt && lockAfter.current >= 0 && Date.now() - hiddenAt >= lockAfter.current * 60_000) onLock.current();
    };
    const touch = () => (last = Date.now());
    const idle = setInterval(() => {
      if (lockAfter.current < 0) return;
      const limit = Math.max(lockAfter.current, 5) * 60_000;
      if (Date.now() - last > limit) onLock.current();
    }, 15_000);
    document.addEventListener('visibilitychange', onVis);
    for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(ev, touch, { passive: true });
    return () => {
      clearInterval(idle);
      document.removeEventListener('visibilitychange', onVis);
      for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(ev, touch);
    };
  }, []);

  // Make sure the last change is written before locking.
  const lock = useCallback(() => {
    saving.current.finally(() => props.onLock());
  }, [props]);

  return <Ctx.Provider value={{ data, update, lock, session, setSession }}>{props.children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store missing');
  return s;
}
