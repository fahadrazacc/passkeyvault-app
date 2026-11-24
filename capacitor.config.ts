import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.passkeyvault.app',
  appName: 'PassKey Vault',
  webDir: 'dist',
  android: { backgroundColor: '#0B0F19', allowMixedContent: false },
  ios: { backgroundColor: '#0B0F19', contentInset: 'never' },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
