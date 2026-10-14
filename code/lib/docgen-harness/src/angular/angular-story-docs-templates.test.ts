// Fills each live story-docs template with the args its story declares, which has to give the static
// snippet, and with values that stress the printer: the whole host component has to parse, and its
// markup has to compile.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { parseTemplate } from '@angular/compiler';
import ts from 'typescript';

import { loadCsf } from 'storybook/internal/csf-tools';
import { UnprintableArgError } from 'storybook/internal/docs-tools';
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

// Values a hole may print where a careless one breaks the code around it: an object opening an
// arrow body, a negative number after an operator, a string that closes quotes or a literal.
const stressValues: unknown[] = [
  { a: [1, 'x'] },
  -1,
  'it\'s "q" `t` ${x} {{ y }} \\ \r\n&amp;',
  [{ b: null }],
  null,
  true,
];

const argSets = (args: Record<string, unknown>) => [
  args,
  {},
  ...stressValues.map((value) =>
    Object.fromEntries(
      Object.entries(args).map(([name, arg]) => [name, typeof arg === 'function' ? arg : value])
    )
  ),
];

const expectCompiles = (filled: string, label: string) => {
  const { diagnostics = [] } = ts.transpileModule(filled, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  });
  expect(
    diagnostics.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n')),
    `${label}\n${filled}`
  ).toEqual([]);
  const markup = extractHostComponentTemplate(filled)!;
  expect(parseTemplate(markup, 'filled.html').errors ?? [], `${label}\n${markup}`).toEqual([]);
};

const fillOrSkip = (template: string, args: Record<string, unknown>) => {
  try {
    return fillTemplate(template, args);
  } catch (error) {
    if (error instanceof UnprintableArgError) {
      return undefined;
    }
    throw error;
  }
};

const filledStories = new Set<string>();

describe('angular story-docs templates', () => {
  it.each(cases)('%s fills to code that parses and markup that compiles', async (fixtureCase) => {
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
      const { template, snippet } = payload!.stories[story.id]!;
      if (template === undefined) {
        continue;
      }
      filledStories.add(`${fixtureCase}/${exportName}`);
      const args = { ...argsOf(storiesModule.default), ...argsOf(storiesModule[exportName]) };
      expect(fillOrSkip(template, args) ?? snippet, `${exportName} filled with its own args`).toBe(
        snippet
      );
      for (const set of argSets(args)) {
        const filled = fillOrSkip(template, set);
        if (filled !== undefined) {
          expectCompiles(filled, `${exportName} ${JSON.stringify(set)}`);
        }
      }
    }
  });

  it('fills a meaningful number of stories', () => {
    expect(filledStories.size).toBeGreaterThan(20);
  });
});
