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
    // Cách này giúp "đánh lừa" Rollup, để nó không đi tìm biến process nữa
    'import.meta.env.VITE_GEMINI_API_KEY': '{}', 
    'global': 'window',
  }
});
