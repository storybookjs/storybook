// Fills each live story-docs template with the args its story declares: its markup has to compile.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { parseTemplate } from '@angular/compiler';

import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { fillTemplate } from '../../../../frameworks/angular-vite/src/client/docs/fill-template.ts';
import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { extractHostComponentTemplate } from '../../../../frameworks/angular-vite/src/docgen/story-docs-snippet.ts';
import { createFixtureDocgen } from './docgen-fixture.ts';
import { listFixtureCases } from './snippet-recorder.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureTrees = ['__testfixtures__', '__storyshapes__', 'story-docs/__testfixtures__'];
const cases = fixtureTrees.flatMap((tree) =>
  listFixtureCases(join(here, tree)).map((fixtureCase) => `${tree}/${fixtureCase}`)
);

const docgen = createFixtureDocgen();

afterAll(() => {
  docgen.dispose();
});

type Annotations = { args?: Record<string, unknown> };

const argsOf = (annotated: (Annotations & { input?: Annotations }) | undefined) =>
  (annotated?.input ?? annotated)?.args ?? {};

const expectCompiles = (markup: string, exportName: string) => {
  expect(parseTemplate(markup, 'filled.html').errors ?? [], exportName).toEqual([]);
};

const filledStories = new Set<string>();

describe('angular story-docs templates', () => {
  it.each(cases)('%s fills to markup that compiles', async (fixtureCase) => {
    const storyPath = join(here, fixtureCase, 'input.stories.ts');
    const title = `TemplateGate/${fixtureCase}`;
    const csf = loadCsf(readFileSync(storyPath, 'utf8'), { makeTitle: () => title }).parse();
    const [[firstExport, first]] = Object.entries(csf._stories);
    const entry: IndexEntry = {
      id: first.id,
      name: first.name ?? firstExport,
      title,
      type: 'story',
      subtype: 'story',
      importPath: storyPath,
    };
    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
    );
    const storiesModule = (await import(/* @vite-ignore */ storyPath)) as Record<
      string,
      Annotations | undefined
    >;

    for (const [exportName, story] of Object.entries(csf._stories)) {
      const { template } = payload!.stories[story.id]!;
      if (template === undefined) {
        continue;
      }
      filledStories.add(`${fixtureCase}/${exportName}`);
      const args = { ...argsOf(storiesModule.default), ...argsOf(storiesModule[exportName]) };
      expectCompiles(extractHostComponentTemplate(fillTemplate(template, args))!, exportName);
    }
  });

  it('fills a meaningful number of stories', () => {
    expect(filledStories.size).toBeGreaterThan(20);
  });
});
