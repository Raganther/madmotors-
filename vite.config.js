import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces dist/index.html with all JS and CSS inlined: one file, like the original game,
// so it can be published as a single artifact page.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/**/*.test.js'] }
});
