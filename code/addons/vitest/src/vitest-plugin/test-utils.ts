import { type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import type { ComponentAnnotations, ComposedStoryFn } from 'storybook/internal/types';

import { server } from '@vitest/browser/context';
import { type Report, composeStory, getCsfFactoryAnnotations } from 'storybook/preview-api';

import { setViewport } from './viewports';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    getInitialGlobals: () => Promise<Record<string, any>>;
  }
}

const { getInitialGlobals } = server.commands;

/**
 * Converts a file URL to a file path, handling URL encoding
 *
 * @param url The file URL to convert (e.g. file:///path/to/file.js)
 * @returns The decoded file path
 */
export const convertToFilePath = (url: string): string => {
  // Remove the file:// protocol
  const path = url.replace(/^file:\/\//, '');
  // Handle Windows paths
  const normalizedPath = path.replace(/^\/+([a-zA-Z]:)/, '$1');
  // Convert %20 to spaces
  return normalizedPath.replace(/%20/g, ' ');
};

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
      annotations.preview ?? globalThis.globalProjectAnnotations,
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
