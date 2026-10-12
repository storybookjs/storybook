// Gates the live story-docs template against the static snippet it is derived from: filled with the
// args a story declares, it has to read exactly as that snippet, and its markup has to compile.
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

// Stories whose filled template legitimately differs from their static snippet, with the markup it
// fills to instead and, where it differs too, the class body. The rest of the host component still
// reads exactly as the static snippet.
const DIFFERS = new Map<string, { markup: string; classBody?: string }>([
  // The static snippet binds an arg set to `undefined` as `[x]="undefined"`; the preview leaves an
  // unset input out.
  [
    '__testfixtures__/decorator-io-basics/ExplicitUndefinedArg',
    { markup: '<sb-decorator-io-basics [count]="1" (clicked)="clicked($event)" />' },
  ],
  [
    'story-docs/__testfixtures__/args-formatting/EveryValueShape',
    {
      markup: [
        '<sb-args-formatting',
        `    [kind]="'secondary'"`,
        '    [offset]="-4"',
        '    [data]="{id: 7, nested: {deep: true}}"',
        `    [tags]="['a', 'b']"`,
        `    [greeting]="'hello'"`,
        '    [formatter]="formatter"',
        '/>',
      ].join('\n'),
    },
  ],
  // The static snippet names an imported value it could not read; the preview writes its value.
  [
    'story-docs/__testfixtures__/meta-actions/ImportedLabel',
    { markup: `<sb-meta-actions [label]="'Shared label'" (onClick)="onClick($event)" />` },
  ],
  // Computed data is filled from the controls; only code stays in a host field.
  [
    '__storyshapes__/button-shapes/HoistedArgs',
    {
      markup: [
        '<sb-shape-button',
        `    [label]="'Save'"`,
        '    [loadingError]="loadingError"',
        '    [items]="[0, 1, 2]"',
        '    (clicked)="clicked($event)"',
        '/>',
      ].join('\n'),
      classBody: [
        '{',
        "  loadingError = new Error('Failed to load cards.');",
        '  clicked(event: unknown) {}',
        '}',
      ].join('\n'),
    },
  ],
  // An action the controls add to `argsToTemplate` is bound, as the renderer binds it.
  [
    '__storyshapes__/button-shapes/ArgTypesAction',
    {
      markup: `<sb-shape-button [label]="'Save'" (clicked)="clicked($event)"></sb-shape-button>`,
      classBody: '{\n  clicked(event: unknown) {}\n}',
    },
  ],
  // The static snippet leaves out a function its markup reads; the live one writes it as written.
  [
    'story-docs/__testfixtures__/live-args/OwnMarkupFunction',
    {
      markup: '<sb-live-args [label]="label" [formatter]="formatter"></sb-live-args>',
      classBody: "{\n  label = 'Save';\n  formatter = (value) => value.trim();\n}",
    },
  ],
]);

// Stories holding a value the preview cannot write, which fall back to their static snippet.
const THROWS = new Set([
  'story-docs/__testfixtures__/live-args/ImportedFormatter',
  'story-docs/__testfixtures__/live-args/ImportedControl',
]);

const classBodyOf = (snippet: string) => snippet.split('export class DemoComponent ')[1];

const expectCompiles = (markup: string, exportName: string) => {
  expect(parseTemplate(markup, 'filled.html').errors ?? [], exportName).toEqual([]);
};

let compared = 0;
const listedAndFilled = new Set<string>();

describe('angular story-docs templates', () => {
  it.each(cases)('%s fills to its static snippet', async (fixtureCase) => {
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
      const { snippet, template } = payload!.stories[story.id]!;
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
      listedAndFilled.add(key);
      if (THROWS.has(key)) {
        expect(() => fillTemplate(template, args), exportName).toThrow();
        continue;
      }
      const filled = fillTemplate(template, args);
      const { before, template: markup } = splitHostComponentTemplate(filled)!;
      expectCompiles(markup, exportName);
      const differs = DIFFERS.get(key);
      if (differs !== undefined) {
        expect(markup, exportName).toBe(differs.markup);
        expect(before, exportName).toBe(splitHostComponentTemplate(snippet!)!.before);
        expect(classBodyOf(filled), exportName).toBe(differs.classBody ?? classBodyOf(snippet!));
        continue;
      }
      expect(filled, exportName).toBe(snippet);
      compared++;
    }
  });

  it('compares a meaningful number of stories, every listed one among them', () => {
    expect(compared).toBeGreaterThan(20);
    expect([...DIFFERS.keys(), ...THROWS].filter((key) => !listedAndFilled.has(key))).toEqual([]);
  });
});
