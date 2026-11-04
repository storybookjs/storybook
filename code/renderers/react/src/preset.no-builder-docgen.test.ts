import { expect, test, vi } from 'vitest';

// Only the deprecated builder docgen uses these optional peer dependencies, so the preset and the
// docgen server must load without them. Loading the built preset takes seconds, hence the timeouts.
// A factory that throws is the only way to fail on import; `spy: true` mocks still load the module.
vi.mock('react-docgen', () => {
  throw new Error('react-docgen must load only when builder docgen runs');
});
vi.mock('react-docgen-typescript', () => {
  throw new Error('react-docgen-typescript must load only when builder docgen runs');
});

test('loads the React preset without the builder docgen packages', async () => {
  // @ts-expect-error The runtime-only preset export has no declaration file.
  await expect(import('@storybook/react/preset')).resolves.toBeDefined();
}, 60_000);

test('loads the docgen server worker without the builder docgen packages', async () => {
  // @ts-expect-error The runtime-only worker export has no declaration file.
  await expect(import('@storybook/react/internal/docgen-worker')).resolves.toBeDefined();
}, 60_000);
