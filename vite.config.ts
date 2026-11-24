import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run build` -> dist/ (the website, and the files bundled into the Android and iPhone apps)
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify('0.1.' + (process.env.GITHUB_RUN_NUMBER ?? 'dev')) },
  plugins: [react()],
})
