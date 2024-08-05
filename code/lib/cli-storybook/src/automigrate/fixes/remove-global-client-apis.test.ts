/* eslint-disable no-underscore-dangle */
import { describe, it, expect, vi } from 'vitest';

import path from 'path';
import * as fsExtra from 'fs-extra';
import type { JsPackageManager } from 'storybook/internal/common';
import { RemovedAPIs, removedGlobalClientAPIs as migration } from './remove-global-client-apis';

vi.mock('fs-extra', async () => import('../../../../../__mocks__/fs-extra'));

const check = async ({ contents, previewConfigPath }: any) => {
  if (contents) {
    vi.mocked<typeof import('../../../../../__mocks__/fs-extra')>(fsExtra as any).__setMockFiles({
      [path.join('.storybook', 'preview.js')]: contents,
    });
  }
  const packageManager = {
    retrievePackageJson: async () => ({ dependencies: {}, devDependencies: {} }),
  } as JsPackageManager;

  return migration.check({
    packageManager,
    mainConfig: {} as any,
    storybookVersion: '7.0.0',
    previewConfigPath,
  });
};

describe('removedGlobalClientAPIs fix', () => {
  it('file does not exist', async () => {
    const contents = false;
    await expect(check({ contents })).resolves.toBeNull();
  });
  it('uses no removed APIs', async () => {
    const contents = `
      export const parameters = {};
    `;
    await expect(
      check({ contents, previewConfigPath: path.join('.storybook', 'preview.js') })
    ).resolves.toBeNull();
  });
  it('uses 1 removed API', async () => {
    const contents = `
      import { addParameters } from '@storybook/react';
      addParameters({});
    `;
    await expect(
      check({ contents, previewConfigPath: path.join('.storybook', 'preview.js') })
    ).resolves.toEqual(
      expect.objectContaining({
        usedAPIs: [RemovedAPIs.addParameters],
      })
    );
  });
  it('uses >1 removed APIs', async () => {
    const contents = `
      import { addParameters, addDecorator } from '@storybook/react';
      addParameters({});
      addDecorator((storyFn) => storyFn());
    `;
    await expect(
      check({ contents, previewConfigPath: path.join('.storybook', 'preview.js') })
    ).resolves.toEqual(
      expect.objectContaining({
        usedAPIs: expect.arrayContaining([RemovedAPIs.addParameters, RemovedAPIs.addDecorator]),
      })
    );
  });
});
