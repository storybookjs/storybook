import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import type { StorySnippetRecipe } from '../../../../../frameworks/angular-vite/src/story-snippet-recipe.ts';
import { renderSnippetFromRecipe } from '../../../../../frameworks/angular-vite/src/story-snippet-recipe.ts';
import { createFixtureDocgen } from '../docgen-fixture.ts';
import { listFixtureCases } from '../snippet-recorder.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// One manager for the whole suite; the fixtures share a single tsconfig.json at the tree root.
const docgen = createFixtureDocgen();

afterAll(() => {
  docgen.dispose();
});

const makeEntry = (storyPath: string, title: string): IndexEntry => ({
  id: `${title.split('/').at(-1)!.toLowerCase()}--primary`,
  name: 'Primary',
  title,
  type: 'story',
  subtype: 'story',
  importPath: storyPath,
});

describe('angular story-docs payload baselines', () => {
  it.each(listFixtureCases(FIXTURES_DIR))('%s', async (fixtureCase) => {
    const testDir = join(FIXTURES_DIR, fixtureCase);
    const storyPath = join(testDir, 'input.stories.ts');
    const title = `StoryDocs/${fixtureCase}`;
    const entry = makeEntry(storyPath, title);
    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
    );

    await expect(payload && { ...payload, path: '__PATH__' }).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
  });
});

// The recipe exists so the preview can rebuild the snippet without the CSF source. If rebuilding it
// from the recipe alone does not reproduce the snippet byte for byte, the recipe is missing an
// ingredient and the preview would quietly render something the server never would.
//
// Which fixtures carry no recipe is asserted too, so the invariant cannot pass by the recipe
// quietly disappearing.
const NO_RECIPE_FIXTURES: Record<string, string> = {
  'args-formatting': 'a function arg only the running story resolves',
  'meta-render': 'the meta supplies its own template',
  'no-component': 'no component to derive bindings from',
  'no-selector': 'reached through *ngComponentOutlet, which shows no args',
};

describe('angular story-docs recipes', () => {
  it('rebuild their own snippet, and are withheld exactly where they cannot be', async () => {
    const withoutRecipe: string[] = [];
    let rebuilt = 0;

    for (const fixtureCase of listFixtureCases(FIXTURES_DIR)) {
      const testDir = join(FIXTURES_DIR, fixtureCase);
      const entry = makeEntry(join(testDir, 'input.stories.ts'), `StoryDocs/${fixtureCase}`);
      const payload = await buildStoryDocsPayload(
        { entry },
        { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
      );

      const stories = Object.values(payload?.stories ?? {});
      const recipes = stories.filter((story) => story.recipe !== undefined);
      if (recipes.length === 0) {
        withoutRecipe.push(fixtureCase);
      }

      for (const story of recipes) {
        expect(renderSnippetFromRecipe(story.recipe as StorySnippetRecipe), fixtureCase).toBe(
          story.snippet
        );
        rebuilt += 1;
      }
    }

    expect(withoutRecipe.sort()).toEqual(Object.keys(NO_RECIPE_FIXTURES).sort());
    expect(rebuilt).toBeGreaterThan(0);
  });
});

// On the dev server the docgen payload is read out of `core/docgen`'s state, which is a deep
// reactive proxy, and the story-docs payload built from it is snapshotted with `structuredClone`.
// Anything carried over by reference is therefore a proxy, and a proxy is not cloneable: the whole
// story-docs load dies with `DataCloneError` and the Code panel stays blank.
//
// The fixture docgen is plain objects, so the proxy is put back here deliberately - without it this
// only reproduces in a real Storybook.
describe('angular story-docs payloads survive the open-service boundary', () => {
  it.each(listFixtureCases(FIXTURES_DIR))('%s', async (fixtureCase) => {
    const testDir = join(FIXTURES_DIR, fixtureCase);
    const entry = makeEntry(join(testDir, 'input.stories.ts'), `StoryDocs/${fixtureCase}`);
    const getDocgenPayload = docgen.getDocgenPayload(entry);
    const payload = await buildStoryDocsPayload(
      { entry },
      {
        getDocgenPayload: async () => proxyDeeply(await getDocgenPayload()),
        resolvePath: (path) => path,
      }
    );

    expect(() => structuredClone(payload)).not.toThrow();
  });
});

/** Stands in for the reactive proxy `core/docgen` wraps its state in. */
const proxyDeeply = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  for (const [key, entry] of Object.entries(value)) {
    (value as Record<string, unknown>)[key] = proxyDeeply(entry);
  }
  return new Proxy(value as object, {}) as T;
};
