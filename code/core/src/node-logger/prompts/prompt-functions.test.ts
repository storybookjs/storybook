import { afterEach, expect, it, vi } from 'vitest';

const setColumns = (value: number | undefined) =>
  Object.defineProperty(process.stdout, 'columns', { value, configurable: true, writable: true });

const originalColumns = Object.getOwnPropertyDescriptor(process.stdout, 'columns');

afterEach(() => {
  if (originalColumns) {
    Object.defineProperty(process.stdout, 'columns', originalColumns);
  }
  vi.resetModules();
});

// `script(1)` and some CI wrappers report a TTY of width 0. Clack divides its rendered line count by
// that width and then erases `Infinity` lines, throwing `RangeError: Invalid string length` — in
// `storybook init` that landed after the project files had already been mutated, and the error
// printer went through the same broken renderer, so nothing was reported.
it.each([0, -1])('pins a terminal that reports %i columns to a usable width', async (columns) => {
  setColumns(columns);
  vi.resetModules();

  await import('./prompt-functions.ts');

  expect(process.stdout.columns).toBe(80);
});

// node-logger is imported by every server-side entry point, so a stream that refuses the write has
// to degrade rather than abort the process at import time.
it('survives a terminal whose width cannot be reassigned', async () => {
  Object.defineProperty(process.stdout, 'columns', {
    value: 0,
    configurable: true,
    writable: false,
  });
  vi.resetModules();

  await expect(import('./prompt-functions.ts')).resolves.toBeDefined();
});

it('leaves a usable terminal width alone', async () => {
  setColumns(120);
  vi.resetModules();

  await import('./prompt-functions.ts');

  expect(process.stdout.columns).toBe(120);
});
