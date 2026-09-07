// @vitest-environment happy-dom
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { composeStories } from 'storybook/preview-api';

import { setProjectAnnotations } from '../../../../renderers/web-components/src/portable-stories.ts';

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
    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const composed = composeStories(storiesModule, projectAnnotations);
    for (const [storyName, Story] of Object.entries(composed)) {
      const canvasElement = document.createElement('div');
      document.body.appendChild(canvasElement);
      await Story.run({ canvasElement });
      expect(canvasElement.firstElementChild, `${fixtureCase}/${storyName}`).not.toBeNull();
    }
  });
});
