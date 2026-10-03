import { configDefaults, defineConfig } from 'vitest/config';

// Pruebas unitarias puras (motor, extractor, sync, eval). Las E2E de Playwright viven en e2e/.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', 'dist/**'],
  },
});
