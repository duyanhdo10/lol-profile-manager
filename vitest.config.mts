import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/integration/**/*.spec.ts',
      'tests/renderer/**/*.spec.ts',
      'tests/renderer/**/*.spec.tsx',
    ],
    environment: 'node',
    setupFiles: ['./tests/renderer/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
