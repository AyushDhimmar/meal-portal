import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// npm run dev      → http://127.0.0.1:3000 on this computer (matches site_url in supabase/config.jsonc)
// npm run dev:lan  → https://<this computer's IP>:3000 for phones and tablets on the same Wi-Fi.
//   Cameras need https, so this uses a self-signed certificate (accept the warning once per device).
//   The phone can't reach this computer's 127.0.0.1, and an https page can't call http, so the
//   dev server passes /sb/* through to the local Supabase and the app talks to /sb instead.

// npm run dev:proxy → http://127.0.0.1:3000 with Supabase reached through /sb on the same address
//   (one address only: useful for browsers or tools that block calls to a second local port).
export default defineConfig(({ mode }) => {
  const lan = mode === 'lan'
  const viaProxy = lan || mode === 'proxy'
  const proxy = { '/sb': { target: 'http://127.0.0.1:54321', changeOrigin: true, ws: true, rewrite: (p: string) => p.replace(/^\/sb/, '') } }
  return {
    plugins: [react(), ...(lan ? [basicSsl()] : [])],
    server: {
      host: lan ? true : '127.0.0.1', port: 3000, strictPort: true,
      ...(viaProxy ? { proxy } : {}),
    },
    define: viaProxy ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('/sb') } : {},
  }
})
