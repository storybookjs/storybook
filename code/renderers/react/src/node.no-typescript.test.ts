import { expect, test, vi } from 'vitest';

vi.mock('typescript', () => {
  throw new Error('TypeScript must not load for a JavaScript project');
});

test('loads the React node addon without TypeScript installed', async () => {
  await expect(import('./node.ts')).resolves.toBeDefined();
});
