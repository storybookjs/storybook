import { expect, it, vi } from 'vitest';

import { withCoverageStaticDir } from './static-dirs.ts';

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn() }));
vi.mock('@storybook/core/internal/common', () => ({
  resolvePathInStorybookCache: (path: string) => `/cache/${path}`,
}));

it.each([
  { configType: 'PRODUCTION' as const, expected: ['/public'] },
  {
    configType: 'DEVELOPMENT' as const,
    expected: [{ from: '/cache/coverage', to: '/coverage' }, '/public'],
  },
])('serves coverage in $configType', async ({ configType, expected }) => {
  expect(await withCoverageStaticDir(['/public'], configType)).toEqual(expected);
});
