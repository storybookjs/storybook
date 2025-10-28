import { type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import { type Meta, type Story, getStoryChildren, isStory } from 'storybook/internal/csf';
import type { ComponentAnnotations, ComposedStoryFn, Renderer } from 'storybook/internal/types';

import { type Report, composeStory, getCsfFactoryAnnotations } from 'storybook/preview-api';

import type { VitestBrowserContext } from './types';
import { setViewport } from './viewports';

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
  storyId: string,
  testName?: string
) => {
  return async (context: TestContext & { story: ComposedStoryFn }) => {
    const annotations = getCsfFactoryAnnotations(story, meta);

    const test =
      isStory(story) && testName
        ? getStoryChildren(story).find((child) => child.input.name === testName)
        : undefined;

    const storyAnnotations = test ? test.input : annotations.story;

    const { server } = (await import(
      // @ts-expect-error - This is an internal alias that will be resolved by the vitest plugin at runtime
      '@storybook/addon-vitest/internal/vitest-context'
    )) as unknown as VitestBrowserContext;

    const { getInitialGlobals } = server.commands;

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

    // The id will always be present, calculated by CsfFile
    // and is needed so that we can add the test to the story in Storybook's UI for the status
    _task.meta.storyId = storyId;

    await setViewport(composedStory.parameters, composedStory.globals);

    await composedStory.run(undefined);

    _task.meta.reports = composedStory.reporting.reports;
  };
};
