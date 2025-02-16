/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */
import { type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import {
  type Report,
  composeStory,
  getCsfFactoryAnnotations,
} from 'storybook/internal/preview-api';
import type { ComponentAnnotations, ComposedStoryFn } from 'storybook/internal/types';

import { server } from '@vitest/browser/context';

import { setViewport } from './viewports';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    getInitialGlobals: () => Promise<Record<string, any>>;
  }
}

const { getInitialGlobals } = server.commands;

export const testStory = (
  exportName: string,
  story: ComposedStoryFn,
  meta: ComponentAnnotations,
  skipTags: string[]
) => {
  return async (context: TestContext & { story: ComposedStoryFn }) => {
    const annotations = getCsfFactoryAnnotations(story, meta);
    const composedStory = composeStory(
      annotations.story,
      annotations.meta!,
      { initialGlobals: (await getInitialGlobals?.()) ?? {} },
      annotations.preview,
      exportName
    );

    if (composedStory === undefined || skipTags?.some((tag) => composedStory.tags.includes(tag))) {
      context.skip();
    }

    context.story = composedStory;

    const _task = context.task as RunnerTask & {
      meta: TaskMeta & { storyId: string; reports: Report[] };
    };
    _task.meta.storyId = composedStory.id;

    await setViewport(composedStory.parameters, composedStory.globals);
    await composedStory.run();

    _task.meta.reports = composedStory.reporting.reports;
  };
};
