import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: [
      'workers/**',
      'tests/rules/**',
      'android/**',
      'dist/**',
      'node_modules/**',
      'scripts/**'
    ],
    environment: 'node',
    globals: false
  }
});
