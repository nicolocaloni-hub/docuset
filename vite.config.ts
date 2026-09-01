import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.TALLY_API_KEY': JSON.stringify(process.env.TALLY_API_KEY),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
});

