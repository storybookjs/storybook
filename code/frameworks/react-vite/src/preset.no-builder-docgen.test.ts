import { expect, test, vi } from 'vitest';

// Only the deprecated builder docgen uses these optional peer dependencies, so the preset must load
// without them.
// A factory that throws is the only way to fail on import; `spy: true` mocks still load the module.
vi.mock('react-docgen', () => {
  throw new Error('react-docgen must load only when builder docgen runs');
});
vi.mock('@joshwooding/vite-plugin-react-docgen-typescript', () => {
  throw new Error('vite-plugin-react-docgen-typescript must load only when builder docgen runs');
});

test('loads the React Vite preset without the builder docgen packages', async () => {
  await expect(import('./preset.ts')).resolves.toBeDefined();
});
