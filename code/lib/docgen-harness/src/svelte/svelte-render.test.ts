// @vitest-environment happy-dom
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import type { Args, StoryAnnotationsOrFn } from 'storybook/internal/types';

import {
  composeStory,
  setProjectAnnotations,
} from '../../../../renderers/svelte/src/portable-stories.ts';
import type { SvelteRenderer } from '../../../../renderers/svelte/src/types.ts';

setProjectAnnotations([]);

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

type SvelteStory = StoryAnnotationsOrFn<SvelteRenderer, Args>;

type StoriesModule = { default: Record<string, unknown> } & Record<string, unknown>;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('svelte fixtures render', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    await renderStories(fixtureCase, 'input.stories.svelte');
    if (existsSync(join(fixturesDir, fixtureCase, 'input.stories.ts'))) {
      await renderStories(fixtureCase, 'input.stories.ts');
    }
  });
});

async function renderStories(fixtureCase: string, fileName: string): Promise<void> {
  const storiesModule = (
    fileName === 'input.stories.svelte'
      ? await import(`./__testfixtures__/${fixtureCase}/input.stories.svelte`)
      : await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`)
  ) as StoriesModule;
  const { default: meta, ...exports } = storiesModule;
  for (const [exportName, story] of Object.entries(exports)) {
    if (!isStoryExport(story)) {
      continue;
    }
    const Story = composeStory(story, meta, undefined, exportName);
    const canvasElement = document.createElement('div');
    document.body.appendChild(canvasElement);
    await Story.run({ canvasElement });
    expect(
      canvasElement.firstElementChild,
      `${fixtureCase}/${fileName}/${exportName}`
    ).not.toBeNull();
    cleanup();
    document.body.replaceChildren();
  }
}

function isStoryExport(value: unknown): value is SvelteStory {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    ('args' in value || 'parameters' in value || 'render' in value || 'tags' in value)
  );
}
