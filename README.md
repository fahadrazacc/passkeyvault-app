# PassKey Vault — Password Manager (web + Android + iPhone)

One React + TypeScript codebase that runs as a website (installable as a PWA) and as Android and iPhone apps via Capacitor. Same setup as Ledgerly.

## Features
- **Encrypted vault**: one master password (min. 10 characters, strength-checked) protects everything. AES-256-GCM, key from PBKDF2-SHA256 with 600,000 rounds and a random salt. The key exists only in memory while unlocked; nothing readable is ever stored or sent.
- **Unlock**: master password, or Face ID / fingerprint on phones (password kept in the iOS Keychain / Android Keystore, tied to the current biometrics). Wrong tries slow down after 5 attempts. Optional lock-screen hint.
- **Auto-lock** when the app is in the background or idle (immediately, 1, 5, 15 or 60 minutes). **Clipboard auto-clear** after copying a password or code.
- **Item types**: logins (username, password, several websites, 2FA key, extra fields), payment cards, secure notes, Wi-Fi, identities. Folders, favorites, search, A–Z list, recently used.
- **Two-factor codes (TOTP)**: paste a site's setup key or `otpauth://` link and the 6-digit code shows with a countdown. Tested against the RFC 4226 / 6238 test vectors (SHA-1, SHA-256, SHA-512).
- **Generator**: random (8–64 chars, character sets, avoid look-alikes), passphrase (EFF 7,776-word list) or PIN. Uses the crypto random source with rejection sampling. Shows strength in bits and crack time. Last 20 kept (encrypted).
- **Security check**: score, breached (Have I Been Pwned, k-anonymity: only 5 characters of the SHA-1 hash leave the device), reused, weak, over a year old, logins without 2FA.
- **Password history**: the last 10 passwords of each login.
- **Import**: LastPass CSV (including cards, Wi-Fi and secure notes), Chrome / Edge / Brave, Apple Passwords / Safari, Firefox, Bitwarden, 1Password. Skips duplicates.
- **Backup**: encrypted backup file (opens only with the master password) and restore; plain CSV export behind a password check.
- **Layouts**: phone (bottom tabs) and web (sidebar + list + detail). Light, dark or automatic theme.
- Android hides the app from screenshots and the recent-apps preview (FLAG_SECURE). The website ships a strict Content Security Policy.

## Not in this version yet
- **Sync between devices**: each device has its own vault today. Move items with a backup file. Next step: end-to-end encrypted sync (Ledgerly's Firebase approach, which only ever uploads the encrypted blob).
- **Autofill** in other apps and browsers (Android Autofill service, iOS AutoFill credential provider extension, browser extension). These need native code and are the next big piece.
- **Storing passkeys** (the passwordless sign-in): needs the same native credential-provider work as autofill.
- **Sharing** items with other people.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # crypto, 2FA codes, generator, strength, CSV import
```

## Builds (GitHub Actions, on every push to `main`)
- **Android**: `.github/workflows/android-apk.yml` builds a test APK and publishes it as a GitHub Release (open the release on your phone, download, install). It's signed with the committed test key so every new build installs over the old one and keeps your vault. Use your own private key for the Play Store.
- **iPhone**: `.github/workflows/ios.yml` builds an unsigned `.ipa` (install with Sideloadly / AltStore, or set up signing for TestFlight).
- **Website**: `.github/workflows/pages.yml` deploys the landing page in `site/` to the root of GitHub Pages and the web app to `/app/` (same layout as Ledgerly):
  - Website: https://fahadrazacc.github.io/passkeyvault-app/
  - Web app: https://fahadrazacc.github.io/passkeyvault-app/app/
  - Latest APK: https://github.com/fahadrazacc/passkeyvault-app/releases/latest/download/PassKeyVault-debug.apk

   One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Must be served over HTTPS.

## Code map
- `src/vault.ts` – encryption, storage, backups, wrong-try slow-down
- `src/totp.ts` – two-factor codes; `src/generator.ts` – generator; `src/strength.ts` – strength estimate
- `src/security.ts` – security report and breach check; `src/importer.ts` – CSV import/export
- `src/platform.ts` – clipboard, Face ID / fingerprint, saving files on phones
- `src/store.tsx` – app state, encrypted save on every change, auto-lock
- `src/screens/` – Lock, Vault, ItemDetail, EditItem, Generator, Security, Settings, Import
- `site/` – landing page, privacy page and screenshots

Passphrase word list: [EFF large wordlist](https://www.eff.org/dice), CC BY 3.0.
