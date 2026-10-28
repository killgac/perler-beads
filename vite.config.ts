import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: killgac.github.io/perler-beads/
  base: '/perler-beads/',
  // Use postcss and disable CSS minify: Vite8 default lightningcss rewrites
  // @media (max-width:1024px) into (width<=1024px) range syntax,
  // which old webview kernels do not recognize, breaking mobile layout.
  css: { transformer: 'postcss' },
  build: { cssMinify: false },
})
