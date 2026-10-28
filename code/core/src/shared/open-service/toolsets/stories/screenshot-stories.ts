import type { StoryIndex } from '@storybook/core/internal/types';

import { join } from 'pathe';

import { buildArgsParam } from '../../../router/utils.ts';
import { findStoryIds } from './find-story-ids.ts';
import type { StoryInput } from './story-input.ts';

export type StoryRenderStatus = 'rendered' | 'errored' | 'play-failed' | 'timeout';

export type StoryViewport = { width: number; height: number };

export type StoryScreenshotRequest = {
  storyId: string;
  /** Storybook UI base URL to render against; the access hosts its own preview when absent. */
  origin?: string;
  /** Relative preview URL of the story, e.g. `iframe.html?id=button--primary&viewMode=story`. */
  iframePath: string;
  viewport: StoryViewport;
  path: string;
  timeoutMs: number;
};

export type StoryScreenshotResult = {
  status: StoryRenderStatus;
  /** Absent when no image could be captured. */
  path?: string;
  error?: string;
  consoleErrors: string[];
};

/** Renders stories in a browser; provided by the host, since core owns no browser or builder. */
export type StoryRenderAccess = {
  /** Rejects with the signal's reason once it aborts. */
  screenshot(
    request: StoryScreenshotRequest,
    options?: { signal?: AbortSignal }
  ): Promise<StoryScreenshotResult>;
};

export type ScreenshotStoryOutput =
  | ({ storyId: string; viewport: StoryViewport } & StoryScreenshotResult)
  | { input: StoryInput; error: string };

export type ScreenshotStoriesParams = {
  access: StoryRenderAccess;
  index: StoryIndex;
  stories: StoryInput[];
  origin?: string;
  viewport: StoryViewport;
  outDir: string;
  timeoutMs: number;
  /** Stops before the next story and cancels the ones in flight. */
  signal?: AbortSignal;
};

const CONCURRENCY = 4;

/** Resolves selectors and screenshots the found stories, keeping per-input errors in input order. */
export async function screenshotStories({
  access,
  index,
  stories,
  origin,
  viewport,
  outDir,
  timeoutMs,
  signal,
}: ScreenshotStoriesParams): Promise<ScreenshotStoryOutput[]> {
  const usedNames = new Map<string, number>();
  const tasks = findStoryIds(index, stories).map((found) => {
    if ('errorMessage' in found) {
      return async (): Promise<ScreenshotStoryOutput> => ({
        input: found.input,
        error: found.errorMessage,
      });
    }
    const storyId = found.entry.id;
    const seen = (usedNames.get(storyId) ?? 0) + 1;
    usedNames.set(storyId, seen);
    const path = join(outDir, seen === 1 ? `${storyId}.png` : `${storyId}-${seen}.png`);
    return async (): Promise<ScreenshotStoryOutput> => ({
      storyId,
      viewport,
      ...(await access.screenshot(
        {
          storyId,
          ...(origin ? { origin } : {}),
          iframePath: iframePathFor(storyId, found.input),
          viewport,
          path,
          timeoutMs,
        },
        { signal }
      )),
    });
  });

  const results: ScreenshotStoryOutput[] = new Array(tasks.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      signal?.throwIfAborted();
      const current = next++;
      results[current] = await tasks[current]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
  return results;
}

function iframePathFor(storyId: string, input: StoryInput): string {
  let path = `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
  const args = buildArgsParam({}, input.props ?? {});
  if (args) {
    path += `&args=${args}`;
  }
  const globals = buildArgsParam({}, input.globals ?? {});
  if (globals) {
    path += `&globals=${globals}`;
  }
  return path;
}
