import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStoryId } from './get-story-id.ts';

describe('getStoryId', () => {
  it('should return the storyId', async () => {
    const cwd = process.cwd();
    const storybook = {
      configDir: join(cwd, '.storybook'),
      callHook: async () => ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    } as any;
    const storyFilePath = join(cwd, 'src', 'components', 'stories', 'Page1.stories.ts');
    const exportedStoryName = 'Default';

    const { storyId, kind } = await getStoryId({ storyFilePath, exportedStoryName }, storybook);

    expect(storyId).toBe('components-stories-page1--default');
    expect(kind).toBe('components-stories-page1');
  });

  it('should throw an error if the storyId cannot be calculated', async () => {
    const cwd = process.cwd();
    const storybook = {
      configDir: join(cwd, '.storybook'),
      callHook: async () => ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    } as any;
    const storyFilePath = join(cwd, 'not-covered-path', 'stories', 'Page1.stories.ts');
    const exportedStoryName = 'Default';

    await expect(() =>
      getStoryId({ storyFilePath, exportedStoryName }, storybook)
    ).rejects.toThrowError();
  });
});
