import { expect, test, vi } from 'vitest';

vi.mock('react-docgen', () => {
  throw new Error('react-docgen must only load when a project uses it');
});

test('loads the React preset and the docgen worker without react-docgen', async () => {
  await expect(import('./preset.ts')).resolves.toHaveProperty('internal_reactDocgenPlan');
  await expect(import('./docgen/docgen-worker.ts')).resolves.toHaveProperty('createDocgenProvider');
});
