import globals from 'globals';

// Kept deliberately small: catch real bugs (undefined names, typos in imports), not style.
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }], 'no-const-assign': 'error', 'no-dupe-keys': 'error' }
  },
  {
    files: ['src/core/**/*.js', 'src/data/**/*.js'],
    // the simulation must stay free of the browser: no DOM/window globals here
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['three', '**/render/**', '**/ui/**', '**/audio/**', '**/game.js'], message: 'core/ and data/ must not depend on rendering, UI or audio.' }] }] }
  },
  {
    files: ['tests/**/*.{js,mjs}', 'tools/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  }
];
