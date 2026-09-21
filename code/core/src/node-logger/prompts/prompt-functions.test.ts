import { afterEach, expect, it, vi } from 'vitest';

const stubStdoutColumns = (descriptor: PropertyDescriptor) => {
  const stdout = Object.create(process.stdout);
  Object.defineProperty(stdout, 'columns', { configurable: true, ...descriptor });

  const stubbedProcess = Object.create(process);
  Object.defineProperty(stubbedProcess, 'stdout', { value: stdout, configurable: true });
  vi.stubGlobal('process', stubbedProcess);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// Some ptys and CI wrappers report non-positive terminal widths.
it.each([0, -1])('pins a terminal that reports %i columns to a usable width', async (columns) => {
  stubStdoutColumns({ value: columns, writable: true });
  vi.resetModules();

  await import('./prompt-functions.ts');

  expect(process.stdout.columns).toBe(80);
});

it('survives a terminal whose width cannot be reassigned', async () => {
  stubStdoutColumns({ value: 0, writable: false });
  vi.resetModules();

  await expect(import('./prompt-functions.ts')).resolves.toBeDefined();
});

it('leaves a usable terminal width alone', async () => {
  stubStdoutColumns({ value: 120, writable: true });
  vi.resetModules();

  await import('./prompt-functions.ts');

  expect(process.stdout.columns).toBe(120);
});
