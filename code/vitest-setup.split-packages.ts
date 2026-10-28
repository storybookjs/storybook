import { vi } from 'vitest';

// `@storybook/core` and the packages above it import the logger by their own specifier.
vi.mock('@storybook/core/internal/node-logger', async (importOriginal) =>
  (await import('./vitest.node-logger-mock.ts')).mockNodeLogger(importOriginal)
);
