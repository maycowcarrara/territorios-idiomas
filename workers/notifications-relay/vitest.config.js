import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['workers/notifications-relay/test/**/*.test.js'],
    environment: 'node',
    globals: false
  }
});
