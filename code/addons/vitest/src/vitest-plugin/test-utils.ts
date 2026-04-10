import { inject, type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import { type Meta, type Story, getStoryChildren, isStory } from 'storybook/internal/csf';
import type { ComponentAnnotations, ComposedStoryFn, Renderer } from 'storybook/internal/types';

import { type Report, composeStory, getCsfFactoryAnnotations } from 'storybook/preview-api';

import { setViewport } from './viewports.ts';

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

export const testStory = ({
  exportName,
  story,
  meta,
  skipTags,
  storyId,
  componentPath,
  testName,
  componentName,
}: {
  exportName: string;
  story: ComposedStoryFn | Story<Renderer>;
  meta: ComponentAnnotations | Meta<Renderer>;
  skipTags: string[];
  storyId: string;
  componentPath?: string;
  testName?: string;
  componentName?: string;
}) => {
  return async (context: TestContext & { story: ComposedStoryFn }) => {
    const annotations = getCsfFactoryAnnotations(story, meta);

    const test =
      isStory(story) && testName
        ? getStoryChildren(story).find((child) => child.input.name === testName)
        : undefined;

    const storyAnnotations = test ? test.input : annotations.story;

    let runConfig: Record<string, unknown> = { a11y: true };
    try {
      runConfig = inject('sb-config') ?? { a11y: true };
    } catch {
      // Standalone Vitest runs might not provide Storybook run config.
    }

    let ghostStoriesEnabled = false;
    try {
      ghostStoriesEnabled = inject('sb-ghost-stories') ?? false;
    } catch {
      // Standalone Vitest runs might not provide Storybook ghost stories config.
    }

    const shouldRunA11yTests = !!runConfig.a11y;
    const initialGlobals = {
      sbConfig: runConfig,
      ...(ghostStoriesEnabled
        ? {
            ghostStories: {
              enabled: true,
            },
          }
        : {}),
      a11y: {
        manual: !shouldRunA11yTests,
      },
    };

    const composedStory = composeStory(
      storyAnnotations,
      annotations.meta!,
      { initialGlobals },
      annotations.preview ?? globalThis.globalProjectAnnotations,
      exportName
    );

    if (composedStory === undefined || skipTags?.some((tag) => composedStory.tags.includes(tag))) {
      context.skip();
    }

    context.story = composedStory;

    const _task = context.task as RunnerTask & {
      meta: TaskMeta & {
        storyId: string;
        reports: Report[];
        componentPath?: string;
        componentName?: string;
      };
    };

    // The id will always be present, calculated by CsfFile
    // and is needed so that we can add the test to the story in Storybook's UI for the status
    _task.meta.storyId = storyId;
    _task.meta.componentPath = componentPath;
    _task.meta.componentName = componentName;

    await setViewport(composedStory.parameters, composedStory.globals);

    await composedStory.run(undefined);

    _task.meta.reports = composedStory.reporting.reports;
  };
};
