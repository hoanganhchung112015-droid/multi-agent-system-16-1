import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Thay vì để trống, hãy ép kiểu rõ ràng để Rollup không bị bối rối
    'process.env': '({})',
    'global': 'window',
  },
  build: {
    // Tắt tính năng minify của Rollup nếu nó vẫn báo lỗi AST (để debug)
    // Sau khi chạy được bạn có thể bật lại (set về true hoặc 'esbuild')
    minify: 'esbuild',
    rollupOptions: {
      // Đảm bảo Rollup không cố gắng bundle các module Node.js vào Client
      external: [],
    }
  }
});
