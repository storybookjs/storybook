import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStoryId, getStoryTitle } from './get-story-id.ts';

describe('getStoryId', () => {
  it('should return the storyId', async () => {
    const cwd = process.cwd();
    const options = {
      configDir: join(cwd, '.storybook'),
      presets: {
        apply: (val: string) => {
          if (val === 'stories') {
            return Promise.resolve(['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)']);
          }
        },
      },
    } as any;
    const storyFilePath = join(cwd, 'src', 'components', 'stories', 'Page1.stories.ts');
    const exportedStoryName = 'Default';

    const { storyId, kind } = await getStoryId({ storyFilePath, exportedStoryName }, options);

    expect(storyId).toBe('components-stories-page1--default');
    expect(kind).toBe('components-stories-page1');
  });

  it('should throw an error if the storyId cannot be calculated', async () => {
    const cwd = process.cwd();
    const options = {
      configDir: join(cwd, '.storybook'),
      presets: {
        apply: (val: string) => {
          if (val === 'stories') {
            return Promise.resolve(['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)']);
          }
        },
      },
    } as any;
    const storyFilePath = join(cwd, 'not-covered-path', 'stories', 'Page1.stories.ts');
    const exportedStoryName = 'Default';

    await expect(() =>
      getStoryId({ storyFilePath, exportedStoryName }, options)
    ).rejects.toThrowError();
  });
});

describe('getStoryTitle', () => {
  it('titles a story in a working dir nested in the stories directory', () => {
    const root = join(process.cwd(), 'monorepo');

    const title = getStoryTitle({
      storyFilePath: join(root, 'packages', 'core', 'src', 'Button.stories.ts'),
      configDir: join(root, '.storybook'),
      workingDir: join(root, 'packages', 'core'),
      stories: ['../packages/@(core|other)/src/**/*.stories.ts'],
    });

    expect(title).toBe('core/src/Button');
  });
});
