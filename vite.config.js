import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 队长拼豆图纸生成器 (Captain Bead Pattern Studio)
// base: 本地默认 '/strawberry/' (挂 imgs.imoons.cn/strawberry/),
//       CF Pages 用 VITE_BASE=/ 环境变量覆盖为 '/' (挂 pages.dev 根域)
export default defineConfig({
  base: process.env.VITE_BASE || '/strawberry/',
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