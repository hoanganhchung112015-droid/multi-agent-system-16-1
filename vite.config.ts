import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Dùng JSON.stringify để đảm bảo giá trị là một JS literal hợp lệ
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify({}),
    'global': 'window',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Tăng cường khả năng tương thích giữa CommonJS và ESM
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // Giúp Rollup xử lý mượt mà hơn các thư viện bên thứ 3
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-markdown'],
        },
      },
    },
  },
});
