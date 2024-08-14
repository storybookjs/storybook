/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */
import { type RunnerTask, type TaskContext, type TaskMeta, type TestContext } from 'vitest';

import type { ComposedStoryFn } from 'storybook/internal/types';

import type { UserOptions } from './types';
import { setViewport } from './viewports';

type TagsFilter = Required<UserOptions['tags']>;

export const isValidTest = (storyTags: string[], tagsFilter: TagsFilter) => {
  const isIncluded =
    tagsFilter?.include.length === 0 || tagsFilter?.include.some((tag) => storyTags.includes(tag));
  const isNotExcluded = tagsFilter?.exclude.every((tag) => !storyTags.includes(tag));

  return isIncluded && isNotExcluded;
};

export const testStory = (Story: ComposedStoryFn, tagsFilter: TagsFilter) => {
  return async (context: TestContext & TaskContext & { story: ComposedStoryFn }) => {
    if (Story === undefined || tagsFilter?.skip.some((tag) => Story.tags.includes(tag))) {
      context.skip();
    }

    context.story = Story;

    const _task = context.task as RunnerTask & { meta: TaskMeta & { storyId: string } };
    _task.meta.storyId = Story.id;

    await setViewport(Story.parameters.viewport);
    await Story.run();
  };
};
