import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRelativePath, invalidateProjectRootCache } from './paths.ts';

describe('getProjectRelativePath', () => {
  beforeEach(() => {
    vi.stubEnv('STORYBOOK_PROJECT_ROOT', '/repo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    invalidateProjectRootCache();
  });

  it.each([
    ['/repo/package.json', 'package.json'],
    ['/repo/packages/web/.storybook/main.js', 'packages/web/.storybook/main.js'],
    ['/repo', '.'],
    ['/elsewhere/package.json', '/elsewhere/package.json'],
    ['/repository/package.json', '/repository/package.json'],
  ])('shows %s as %s', (path, shown) => {
    expect(getProjectRelativePath(path)).toBe(shown);
  });

  it('uses forward slashes for a Windows path inside the project', () => {
    vi.stubEnv('STORYBOOK_PROJECT_ROOT', 'C:\\repo');

    expect(getProjectRelativePath('C:\\repo\\.storybook\\main.ts')).toBe('.storybook/main.ts');
  });
});
