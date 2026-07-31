import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 队长拼豆图纸生成器 (Captain Bead Pattern Studio)
// base = '/strawberry/' 让 build 产物可直接挂到 imgs.imoons.cn/strawberry/
// outDir = 'dist' 符合 Cloudflare Pages 默认约定, 同时本地也用同一目录
export default defineConfig({
  base: '/strawberry/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5181,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4181,
    strictPort: true,
  },
});