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
import { splitHostComponentTemplate } from '../../../../frameworks/angular-vite/src/template-grammar.ts';
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

type Annotations = {
  args?: Record<string, unknown>;
  argTypes?: Record<string, { action?: string } | undefined>;
};
type Annotated = Annotations & { input?: Annotations };

const annotationsOf = (annotated: Annotated | undefined) => annotated?.input ?? annotated ?? {};

// The actions addon gives an arg its argTypes mark as an action a function, which the story's own
// args override.
const actionsOf = (annotated: Annotated | undefined) =>
  Object.fromEntries(
    Object.entries(annotationsOf(annotated).argTypes ?? {})
      .filter(([, argType]) => argType?.action !== undefined)
      .map(([name]) => [name, () => {}])
  );

const argsOf = (annotated: Annotated | undefined) => annotationsOf(annotated).args ?? {};

// Stories holding a value the preview cannot write, which fall back to their static snippet.
const THROWS = new Set([
  'story-docs/__testfixtures__/live-args/ImportedFormatter',
  'story-docs/__testfixtures__/live-args/ImportedControl',
]);

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
      Annotated | undefined
    >;

    for (const [exportName, story] of Object.entries(csf._stories)) {
      const { template } = payload!.stories[story.id]!;
      const annotated = storiesModule[exportName];
      const args = {
        ...actionsOf(storiesModule.default),
        ...actionsOf(annotated),
        ...argsOf(storiesModule.default),
        ...argsOf(annotated),
      };
      if (template === undefined) {
        continue;
      }
      const key = `${fixtureCase}/${exportName}`;
      filledStories.add(key);
      if (THROWS.has(key)) {
        expect(() => fillTemplate(template, args), exportName).toThrow();
        continue;
      }
      expectCompiles(
        splitHostComponentTemplate(fillTemplate(template, args))!.template,
        exportName
      );
    }
  });

  it('fills a meaningful number of stories, every listed one among them', () => {
    expect(filledStories.size).toBeGreaterThan(20);
    expect([...THROWS].filter((key) => !filledStories.has(key))).toEqual([]);
  });
});
