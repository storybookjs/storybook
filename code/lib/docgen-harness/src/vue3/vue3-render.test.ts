// @vitest-environment happy-dom
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, render } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';

import { composeStories, setProjectAnnotations } from '@storybook/vue3';

// Proves every fixture component and story renders in the Vue toolchain (portable stories,
// following code/renderers/vue3/src/__tests__/composeStories/portable-stories.test.ts).

setProjectAnnotations([]);

afterEach(() => {
  cleanup();
});

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('vue3 fixtures render', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const composed = composeStories(storiesModule);
    for (const [storyName, Story] of Object.entries(composed)) {
      const { container } = render(Story);
      expect(container.firstElementChild, `${fixtureCase}/${storyName}`).not.toBeNull();
      cleanup();
    }
  });
});
