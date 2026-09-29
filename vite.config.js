import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces dist/index.html with all JS and CSS inlined: one file, like the original game,
// so it can be published as a single artifact page.
export default defineConfig(({ mode }) => ({
  // the Asset Lab build (npm run lab) is its own page
  plugins: [viteSingleFile(), { name: 'lab-title', transformIndexHtml: h => mode === 'lab' ? h.replace(/<title>[^<]*<\/title>/, '<title>Asset Lab</title>') : h }],
  build: { target: 'es2020', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/**/*.test.js'] }
}));
