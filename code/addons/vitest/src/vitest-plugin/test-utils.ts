import { type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import { type Meta, type Story, isStory, toTestId } from 'storybook/internal/csf';
import type { ComponentAnnotations, ComposedStoryFn, Renderer } from 'storybook/internal/types';

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
  story: ComposedStoryFn | Story<Renderer>,
  meta: ComponentAnnotations | Meta<Renderer>,
  skipTags: string[],
  testName?: string
) => {
  return async (context: TestContext & { story: ComposedStoryFn }) => {
    const annotations = getCsfFactoryAnnotations(story, meta);

    const storyAnnotations =
      isStory(story) && testName ? story.getAllTests()[testName].story.input : annotations.story;

    const composedStory = composeStory(
      storyAnnotations,
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

    if (testName) {
      _task.meta.storyId = toTestId(composedStory.id, testName);
    } else {
      _task.meta.storyId = composedStory.id;
    }

    await setViewport(composedStory.parameters, composedStory.globals);

    if (isStory(story) && testName) {
      await composedStory.run(undefined, story.getAllTests()[testName].test);
    } else {
      await composedStory.run(undefined);
    }

    _task.meta.reports = composedStory.reporting.reports;
  };
};
