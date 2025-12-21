import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  define: {
    // Không ghi đè từng biến lẻ, chỉ cung cấp một đối tượng trống để tránh lỗi tham chiếu
    'import.meta.env.VITE_GEMINI_API_KEY': {}
  },
  resolve: {
    alias: {
      // Thiết lập alias chuẩn để tránh lỗi import đường dẫn
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Tối ưu hóa việc đóng gói để tăng tốc độ load app
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-markdown'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  }
});
