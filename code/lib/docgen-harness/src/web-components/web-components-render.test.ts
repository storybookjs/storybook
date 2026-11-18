// @vitest-environment happy-dom
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ComposedStoryFn,
  Store_CSFExports,
  StoryAnnotationsOrFn,
} from 'storybook/internal/types';
import { composeStories } from 'storybook/preview-api';

import { setProjectAnnotations } from '../../../../renderers/web-components/src/portable-stories.ts';
import type { WebComponentsRenderer } from '../../../../renderers/web-components/src/types.ts';

type StoriesModule = Store_CSFExports<WebComponentsRenderer> &
  Record<string, StoryAnnotationsOrFn<WebComponentsRenderer>>;
type ComposedStoriesModule = Record<string, ComposedStoryFn<WebComponentsRenderer>>;

const projectAnnotations = setProjectAnnotations([]);

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

afterEach(() => {
  document.body.replaceChildren();
});

describe('web-components fixtures render', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const storiesModule = (await import(
      `./__testfixtures__/${fixtureCase}/input.stories.ts`
    )) as StoriesModule;
    const composed: ComposedStoriesModule = composeStories(storiesModule, projectAnnotations);
    for (const [storyName, Story] of Object.entries(composed)) {
      const canvasElement = document.createElement('div');
      document.body.appendChild(canvasElement);
      await Story.run({ canvasElement });
      expect(canvasElement.firstElementChild, `${fixtureCase}/${storyName}`).not.toBeNull();
    }
  });
});
