import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { storyNameFromExport, toId } from 'storybook/internal/csf';
import { getCsfFactoryAnnotations } from 'storybook/internal/preview-api';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import {
  isStorySnippetTemplate,
  renderSnippetFromTemplate,
} from '../../../../../frameworks/angular-vite/src/story-snippet-template.ts';
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

// The snippet template exists so the preview can rebuild the snippet without the CSF source. It
// carries holes rather than values, so the values come from the fixture's own story module: the
// same object a running preview holds as its args. If filling the template with those does not
// reproduce the snippet byte for byte, the two sides disagree and the preview would quietly render
// something the server never would.
//
// Which stories carry no template is asserted too, so the invariant cannot pass by the mechanism
// quietly disappearing.
const NO_TEMPLATE_STORIES: Record<string, string> = {
  'args-formatting/EveryValueShape': 'a function arg only the running story resolves',
  'meta-render/InheritsMetaRender': 'the meta supplies its own template',
  'no-component/Primary': 'no component to derive bindings from',
  'no-selector/Primary': 'reached through *ngComponentOutlet, which shows no args',
  'render-function/CustomRender': 'the story supplies its own markup',
};

describe('angular story-docs snippet templates', () => {
  it('rebuild their own snippet from the story’s live args, and are withheld exactly where they cannot be', async () => {
    const withoutTemplate: string[] = [];
    let rebuilt = 0;

    for (const fixtureCase of listFixtureCases(FIXTURES_DIR)) {
      const testDir = join(FIXTURES_DIR, fixtureCase);
      const storyPath = join(testDir, 'input.stories.ts');
      const title = `StoryDocs/${fixtureCase}`;
      const entry = makeEntry(storyPath, title);
      const payload = await buildStoryDocsPayload(
        { entry },
        { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
      );

      const { default: meta, ...storyExports } = await import(
        `./__testfixtures__/${fixtureCase}/input.stories.ts`
      );

      for (const [exportName, storyExport] of Object.entries(storyExports)) {
        const storyId = toId(title, storyNameFromExport(exportName));
        const story = payload?.stories[storyId];
        if (story?.snippetTemplate === undefined) {
          withoutTemplate.push(`${fixtureCase}/${exportName}`);
          continue;
        }
        const annotations = getCsfFactoryAnnotations(storyExport as never, meta);
        const args = { ...annotations.meta?.args, ...annotations.story?.args };
        // The preview renders nothing its own guard rejects, so the guard is what the server has to
        // satisfy. Asserting only the rendered string passes even when the two sides no longer agree
        // on the discriminator, which is the silent way this feature switches itself off.
        if (!isStorySnippetTemplate(story.snippetTemplate)) {
          expect.fail(`${fixtureCase}/${exportName}: the preview's guard rejects this template`);
        }

        expect(
          renderSnippetFromTemplate(story.snippetTemplate, args),
          `${fixtureCase}/${exportName}`
        ).toBe(story.snippet);
        rebuilt += 1;
      }
    }

    expect(withoutTemplate.sort()).toEqual(Object.keys(NO_TEMPLATE_STORIES).sort());
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
