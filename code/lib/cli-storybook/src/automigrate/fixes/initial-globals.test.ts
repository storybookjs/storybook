/* eslint-disable no-underscore-dangle */
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import * as fsExtra from 'fs-extra';

import { initialGlobals } from './initial-globals';

vi.mock('fs-extra', async () => import('../../../../../__mocks__/fs-extra'));

const previewConfigPath = join('.storybook', 'preview.js');
const check = async (previewContents: string) => {
  vi.mocked<typeof import('../../../../../__mocks__/fs-extra')>(fsExtra as any).__setMockFiles({
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
