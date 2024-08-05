import { describe, expect, it } from 'vitest';
import type { StorybookConfig } from 'storybook/internal/types';
import { autodocsTags } from './autodocs-tags';

const check = async ({
  main: mainConfig,
  storybookVersion = '7.0.0',
  previewConfigPath,
}: {
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
  previewConfigPath?: string;
}) => {
  return autodocsTags.check({
    packageManager: {} as any,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
    previewConfigPath,
  });
};

it('with no docs setting', async () => {
  await expect(
    check({
      main: {},
    })
  ).resolves.toBeFalsy();
});

describe('docs.autodocs = true', () => {
  it('errors with no preview.js', async () => {
    await expect(
      check({
        main: {
          docs: { autodocs: true },
        },
      })
    ).rejects.toThrowError();
  });

  it('continues with preview.js', async () => {
    await expect(
      check({
        main: {
          docs: { autodocs: true },
        },
        previewConfigPath: '.storybook/preview.js',
      })
    ).resolves.toBeTruthy();
  });
});

describe('docs.autodocs != true', () => {
  it('docs.autodocs = false', async () => {
    await expect(
      check({
        main: {
          docs: { autodocs: false },
        },
      })
    ).resolves.toBeTruthy();
  });

  it('docs.autodocs = "tag"', async () => {
    await expect(
      check({
        main: {
          docs: { autodocs: 'tag' },
        },
      })
    ).resolves.toBeTruthy();
  });
});
