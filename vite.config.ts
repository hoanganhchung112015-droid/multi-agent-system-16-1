import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Lưu ý: Phải bọc trong JSON.stringify để Vite hiểu đây là một chuỗi giá trị literal
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify({}),
    'global': 'window',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Tối ưu hóa build để tránh lỗi AST
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  }
});
