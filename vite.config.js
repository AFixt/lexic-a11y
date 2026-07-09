import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4001,
    open: true,
  },
  build: {
    outDir: 'build',
  },
  esbuild: {
    loader: 'jsx',
    // Treat .js/.jsx in both the library source and the examples as JSX so the
    // example can import straight from src/ with no build step.
    include: /(?:src|examples)\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
});
