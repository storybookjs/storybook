import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getWorkingDir } from './getStorybookData.ts';

describe('getWorkingDir', () => {
  it.each([
    ['.', process.cwd()],
    ['.storybook', process.cwd()],
    ['./.storybook', process.cwd()],
    ['packages/foo/.storybook', resolve(process.cwd(), 'packages/foo')],
    ['./apps/web/.storybook', resolve(process.cwd(), 'apps/web')],
  ])('resolves relative configDir %j to %j', (configDir, expected) => {
    expect(getWorkingDir(configDir)).toBe(expected);
  });

  it('uses the parent directory for absolute config dirs', () => {
    const configDir = resolve('/projects/foo/.storybook');
    expect(getWorkingDir(configDir)).toBe(dirname(configDir));
  });
});
