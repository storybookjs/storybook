// Fills each live story-docs template with the args its story declares, each as the code it is
// written with where it has one, as the preview fills it, which has to give the static snippet, and
// with values that stress the printer: the whole host component has to parse, and its
// markup has to compile.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { parseTemplate } from '@angular/compiler';
import ts from 'typescript';

import { loadCsf } from 'storybook/internal/csf-tools';
import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { fillTemplate } from '../../../../frameworks/angular-vite/src/client/docs/fill-template.ts';
import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { extractHostComponentTemplate } from '../../../../frameworks/angular-vite/src/docgen/story-docs-snippet.ts';
import { analyzeStoryTemplate } from '../../../../frameworks/angular-vite/src/docgen/story-docs-template-analysis.ts';
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

// The args as the preview fills them while they hold the values the story writes.
const asWritten = (args: Record<string, unknown>, argCode: Record<string, string> = {}) => ({
  ...args,
  ...Object.fromEntries(Object.entries(argCode).map(([name, code]) => [name, writtenArg(code)])),
});

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

// The names the host component's markup reads that its class declares no member for. A snippet
// that reads one has to say so: the component would not compile.
const undeclaredNames = (code: string): string[] => {
  const markup = extractHostComponentTemplate(code);
  const analysis = markup === undefined ? undefined : analyzeStoryTemplate(markup);
  if (analysis?.kind !== 'resolved') {
    return [];
  }
  const declared = new Set<string>();
  const source = ts.createSourceFile('demo.ts', code, ts.ScriptTarget.ES2022);
  source.forEachChild((node) => {
    if (ts.isClassDeclaration(node)) {
      node.members.forEach(({ name }) => name && ts.isIdentifier(name) && declared.add(name.text));
    }
  });
  return analysis.referencedNames.filter((name) => !declared.has(name));
};

const expectDeclaresWhatItReads = (code: string, warning: string | undefined, label: string) => {
  if (warning === undefined) {
    expect(undeclaredNames(code), `${label} reads names it does not declare\n${code}`).toEqual([]);
  }
};

interface FilledStory {
  name: string;
  template: string;
  snippet: string;
  warning?: string;
  templateWarning?: string;
  argCode?: Record<string, string>;
  args: Record<string, unknown>;
}

// Each fixture is built once, whichever test asks for it first.
const built = new Map<string, Promise<{ stories: FilledStory[]; snippets: FilledStory[] }>>();
const buildFixture = (fixtureCase: string) => {
  let pending = built.get(fixtureCase);
  if (!pending) {
    pending = buildStories(fixtureCase);
    built.set(fixtureCase, pending);
  }
  return pending;
};

const buildStories = async (fixtureCase: string) => {
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
  const snippets = Object.entries(csf._stories).flatMap(([exportName, story]) => {
    const {
      template = '',
      snippet,
      warning,
      templateWarning,
      argCode,
    } = payload!.stories[story.id]!;
    const args = { ...argsOf(storiesModule.default), ...argsOf(storiesModule[exportName]) };
    return snippet === undefined
      ? []
      : [
          {
            name: `${fixtureCase}/${exportName}`,
            template,
            snippet,
            warning,
            templateWarning,
            argCode,
            args,
          },
        ];
  });
  return { snippets, stories: snippets.filter(({ template }) => template !== '') };
};

describe('angular story-docs templates', () => {
  it.each(cases)('%s fills to code that parses and markup that compiles', async (fixtureCase) => {
    for (const { name, template, snippet, args, argCode } of (await buildFixture(fixtureCase))
      .stories) {
      expect(
        fillOrSkip(template, asWritten(args, argCode)) ?? snippet,
        `${name} filled with its own args`
      ).toBe(snippet);
      for (const set of argSets(args)) {
        const filled = fillOrSkip(template, set);
        if (filled !== undefined) {
          expectCompiles(filled, `${name} ${JSON.stringify(set)}`);
        }
      }
    }
  });

  it.each(cases)('%s declares every name its markup reads, or warns', async (fixtureCase) => {
    const { snippets } = await buildFixture(fixtureCase);
    for (const { name, template, snippet, warning, templateWarning, args } of snippets) {
      expectDeclaresWhatItReads(snippet, warning, `${name}'s static snippet`);
      for (const set of template === '' ? [] : argSets(args)) {
        const filled = fillOrSkip(template, set);
        if (filled !== undefined) {
          expectDeclaresWhatItReads(
            filled,
            templateWarning,
            `${name} filled with ${JSON.stringify(set)}`
          );
        }
      }
    }
  });

  it('fills a meaningful number of stories', async () => {
    const built = await Promise.all(cases.map(buildFixture));
    expect(built.flatMap(({ stories }) => stories).length).toBeGreaterThan(20);
  });
});
