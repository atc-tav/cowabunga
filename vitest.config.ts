import { defineConfig } from 'vitest/config';

// Mode-1 unit tests (per src/shared/testkit/README.md): pure logic only, run in
// Node — no DOM, no Phaser. Keep test files importing pure modules directly so
// they never pull the engine in.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
