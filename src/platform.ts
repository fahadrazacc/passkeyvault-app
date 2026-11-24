// Phone-specific bits: clipboard, fingerprint / Face ID unlock, and saving or sharing files.
import { Capacitor } from '@capacitor/core';
import { getMeta, setMeta } from './vault';

export const isNativeApp = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const bioName = () => (isIOS() ? 'Face ID' : 'fingerprint');
export const BioName = () => (isIOS() ? 'Face ID' : 'Fingerprint');

// ---------- clipboard ----------

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let lastCopied = '';

async function writeClip(text: string) {
  if (isNativeApp()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / blocked API: fall back to a hidden text box.
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

/** Copies text and, for secrets, wipes the clipboard again after `clearAfterSec`. */
export async function copy(text: string, clearAfterSec = 0) {
  await writeClip(text);
  lastCopied = text;
  clearTimeout(clearTimer);
  if (clearAfterSec > 0)
    clearTimer = setTimeout(async () => {
      try {
        // Only clear if what we copied is still there (when we can check).
        if (!isNativeApp() && navigator.clipboard?.readText) {
          const now = await navigator.clipboard.readText().catch(() => lastCopied);
          if (now !== lastCopied) return;
        }
        await writeClip('');
      } catch {
        /* the page may not have focus; nothing more we can do */
      }
    }, clearAfterSec * 1000);
}

// ---------- biometric unlock ----------
// The master password is kept in the iOS Keychain / Android Keystore, bound to the current
// fingerprints or face, and can only be read back after a successful scan.

const SERVER = 'com.passkeyvault.app.master';
const bio = () => import('@capgo/capacitor-native-biometric');

export async function biometricAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { NativeBiometric } = await bio();
    return (await NativeBiometric.isAvailable()).isAvailable;
  } catch {
    return false;
  }
}

export const biometricEnabled = () => isNativeApp() && getMeta().biometric;

export async function enableBiometric(master: string) {
  const { NativeBiometric, AccessControl } = await bio();
  await NativeBiometric.verifyIdentity({ title: `Turn on ${bioName()} unlock`, reason: 'Confirm it is you', negativeButtonText: 'Cancel' });
  await NativeBiometric.setCredentials({ username: 'passkeyvault', password: master, server: SERVER, accessControl: AccessControl.BIOMETRY_CURRENT_SET });
  setMeta({ biometric: true });
}

export async function disableBiometric() {
  setMeta({ biometric: false });
  try {
    const { NativeBiometric } = await bio();
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    /* nothing stored */
  }
}

export async function unlockWithBiometric(): Promise<string> {
  const { NativeBiometric } = await bio();
  const c = await NativeBiometric.getSecureCredentials({ server: SERVER, title: 'Unlock PassKey Vault', reason: 'Unlock your vault' });
  return c.password;
}

export async function refreshBiometric(master: string) {
  if (!biometricEnabled()) return;
  try {
    const { NativeBiometric, AccessControl } = await bio();
    await NativeBiometric.setCredentials({ username: 'passkeyvault', password: master, server: SERVER, accessControl: AccessControl.BIOMETRY_CURRENT_SET });
  } catch {
    await disableBiometric();
  }
}

// ---------- files ----------

/** Saves a text file: a download on the web, the share sheet (Files, Drive, email…) on phones. */
export async function saveFile(name: string, text: string, mime = 'application/json') {
  if (isNativeApp()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: res.uri, dialogTitle: 'Save backup' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Opens the file picker and returns the chosen file's text. */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
