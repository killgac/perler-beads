import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 项目站：killgac.github.io/perler-beads/，资源路径需带仓库名前缀
  base: '/perler-beads/',
})
