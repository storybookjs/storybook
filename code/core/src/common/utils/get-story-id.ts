import { relative } from 'node:path';

import { normalizeStories, normalizeStoryPath } from '@storybook/core/internal/common';
import { sanitize, storyNameFromExport, toId } from '@storybook/core/internal/csf/csf-utils';
import type { StoriesEntry } from '@storybook/core/internal/types';

import { dedent } from 'ts-dedent';

import type { Storybook } from '../../instance/types.ts';
import { userOrAutoTitleFromSpecifier } from '../../shared/story-index/autoTitle.ts';
import { posix } from './posix.ts';

interface StoryIdData {
  storyFilePath: string;
  exportedStoryName: string;
}

type GetStoryIdOptions = StoryIdData & {
  configDir: string;
  stories: StoriesEntry[];
  workingDir?: string;
  userTitle?: string;
  storyFilePath: string;
};

export async function getStoryId(
  data: StoryIdData,
  storybook: Pick<Storybook, 'callHook' | 'configDir'>
): Promise<{ storyId: string; kind: string }> {
  const stories = await storybook.callHook('core:stories:collect', []);

  const autoTitle = getStoryTitle({
    ...data,
    stories,
    configDir: storybook.configDir,
  });

  if (autoTitle === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(dedent`
    The new story file was successfully generated, but we are unable to index it. Please ensure that the new Story file is matched by the 'stories' glob pattern in your Storybook configuration.
    `);
  }

  const storyName = storyNameFromExport(data.exportedStoryName);

  const storyId = toId(autoTitle as string, storyName);
  const kind = sanitize(autoTitle);

  return { storyId, kind };
}

export function getStoryTitle({
  storyFilePath,
  configDir,
  stories,
  workingDir = process.cwd(),
  userTitle,
}: Omit<GetStoryIdOptions, 'exportedStoryName'>) {
  const normalizedStories = normalizeStories(stories, {
    configDir,
    workingDir,
  });

  const relativePath = relative(workingDir, storyFilePath);
  const importPath = posix(normalizeStoryPath(relativePath));

  return normalizedStories
    .map((normalizeStory) => userOrAutoTitleFromSpecifier(importPath, normalizeStory, userTitle))
    .filter(Boolean)[0];
}
