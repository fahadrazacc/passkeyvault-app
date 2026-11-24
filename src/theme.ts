// Light / dark / follow-the-device theme.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { getMeta, setMeta } from './vault';

type Pref = 'system' | 'light' | 'dark';
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
let current: Pref = 'system';
const listeners = new Set<() => void>();

export const isDark = () => document.documentElement.dataset.theme === 'dark';
export const onThemeChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

function paint() {
  const dark = current === 'dark' || (current === 'system' && !!media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0F19' : '#F3F5FA');
  if (Capacitor.isNativePlatform()) SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
  listeners.forEach((f) => f());
}

export function applyTheme(pref: Pref) {
  current = pref;
  if (getMeta().theme !== pref) setMeta({ theme: pref });
  paint();
}

export function initTheme() {
  current = getMeta().theme;
  media?.addEventListener('change', paint);
  paint();
}
