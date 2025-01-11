/* eslint-disable no-underscore-dangle */
import * as fsp from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { initialGlobals } from './initial-globals';

vi.mock('node:fs/promises', async () => import('../../../../../__mocks__/fs/promises'));

const previewConfigPath = join('.storybook', 'preview.js');
const check = async (previewContents: string) => {
  vi.mocked<typeof import('../../../../../__mocks__/fs/promises')>(fsp as any).__setMockFiles({
    [previewConfigPath]: previewContents,
  });
  return initialGlobals.check({
    packageManager: {} as any,
    configDir: '',
    mainConfig: {} as any,
    storybookVersion: '8.0',
    previewConfigPath,
  });
};

it('no globals setting', async () => {
  await expect(check(`export default { tags: ['a', 'b']}`)).resolves.toBeFalsy();
});

it('initialGlobals setting', async () => {
  await expect(check(`export default { initialGlobals: { a:  1 } }`)).resolves.toBeFalsy();
});

it('globals setting', async () => {
  await expect(check(`export default { globals: { a:  1 } }`)).resolves.toBeTruthy();
});
