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
    // Sử dụng JSON.stringify để biến {} thành một chuỗi literal hợp lệ
    // Giúp triệt tiêu lỗi "Invalid define value" và lỗi "parseAst"
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify({}),
    'global': 'window',
  },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      external: [],
    }
  }
});
