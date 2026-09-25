import { expect, test, vi } from 'vitest';

vi.mock('typescript', () => {
  throw new Error('TypeScript must not load for a JavaScript project');
});

test('loads the React preset without TypeScript installed', async () => {
  await expect(import('./preset.ts')).resolves.toBeDefined();
});
