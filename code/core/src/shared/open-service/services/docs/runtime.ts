import type { StoryIndex } from 'storybook/internal/types';

import { classifyIndex, type IndexClassification } from './classify-index.ts';

export type DocsRuntime = {
  getIndex: () => Promise<StoryIndex>;
};

let runtime: DocsRuntime | undefined;
let lastClassification: IndexClassification | undefined;

/** Stores registration-time dependencies for `core/docs` query loads. */
export function setDocsRuntime(next: DocsRuntime): void {
  runtime = next;
  lastClassification = undefined;
}

/** Clears registration-time dependencies (tests). */
export function clearDocsRuntime(): void {
  runtime = undefined;
  lastClassification = undefined;
}

/** Returns the active docs runtime, or throws when `core/docs` was registered without one. */
export function getDocsRuntime(): DocsRuntime {
  if (!runtime) {
    throw new Error(
      'core/docs runtime is not configured. Call registerDocsService({ getIndex }) before using docs queries.'
    );
  }
  return runtime;
}

/** Loads and caches the current index classification for sync query handlers. */
export async function loadDocsClassification(): Promise<IndexClassification> {
  lastClassification = classifyIndex(await getDocsRuntime().getIndex());
  return lastClassification;
}

/** Returns the classification produced by the most recent `loadDocsClassification()` call. */
export function getDocsClassification(): IndexClassification {
  if (!lastClassification) {
    throw new Error(
      'core/docs classification is not loaded. Use docs query `.loaded()` before `.get()`.'
    );
  }
  return lastClassification;
}
