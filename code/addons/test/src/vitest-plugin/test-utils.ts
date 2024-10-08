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

    const _task = context.task as RunnerTask & {
      meta: TaskMeta & { storyId: string; instrumenterState: any };
    };
    _task.meta.storyId = composedStory.id;
    globalThis.__STORYBOOK_PREVIEW__ = {
      selectionStore: {
        // @ts-expect-error xyz
        selection: {
          storyId: composedStory.id,
        },
      },
    };
    const instrumenter = globalThis.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__;
    instrumenter.cleanup();

    await setViewport(composedStory.parameters.viewport);
    await composedStory.run();

    _task.meta.instrumenterState = (
      globalThis.window?.parent as any
    )?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__;

    console.log(
      'final state',
      JSON.stringify(
        (globalThis.window?.parent as any)?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__
      )
    );
  };
};
