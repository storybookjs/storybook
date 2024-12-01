/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */
import { type RunnerTask, type TaskContext, type TaskMeta, type TestContext } from 'vitest';

import { composeStory } from 'storybook/internal/preview-api';
import type { ComponentAnnotations, ComposedStoryFn } from 'storybook/internal/types';

import { setViewport } from './viewports';

export const testStory = (
  exportName: string,
  story: ComposedStoryFn,
  meta: ComponentAnnotations,
  skipTags: string[]
) => {
  const composedStory = composeStory(story, meta, undefined, undefined, exportName);
  return async (context: TestContext & TaskContext & { story: ComposedStoryFn }) => {
    if (composedStory === undefined || skipTags?.some((tag) => composedStory.tags.includes(tag))) {
      context.skip();
    }

    context.story = composedStory;

    const _task = context.task as RunnerTask & { meta: TaskMeta & { storyId: string } };
    _task.meta.storyId = composedStory.id;

    await setViewport(composedStory.parameters, composedStory.globals);
    await composedStory.run();
  };
};
