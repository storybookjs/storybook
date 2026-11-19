import { expect, test, vi } from 'vitest';

vi.mock('typescript', () => {
  throw new Error('TypeScript must not load for a JavaScript project');
});

test('loads the React preset without TypeScript installed', async () => {
  // @ts-expect-error The runtime-only preset export has no declaration file.
  await expect(import('@storybook/react/preset')).resolves.toBeDefined();
});
