import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  type ESTreeNode,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  loadCsf,
} from 'storybook/internal/csf-tools';
import {
  UnprintableArgError,
  argChanges,
  fillTemplate,
  stripHoles,
} from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../renderers/web-components/src/docgen/story-docs/build-story-docs.ts';
import { evaluateArgValue } from '../../../../renderers/web-components/src/docgen/story-docs/arg-values.ts';
import { printHole } from '../../../../renderers/web-components/src/docs/print-hole.ts';
import type { HtmlSnippetTemplate } from '../../../../renderers/web-components/src/snippet-holes.ts';
import { createFixtureDocgen } from './story-docs/docgen-fixture.ts';
import {
  expectNoStaleSnippets,
  NO_SNIPPET_SENTINEL,
  recordServerSnippet,
} from '../compare/server-snippet-recorder.ts';
import { withReadableTemplates } from '../compare/readable-templates.ts';

const STYLE_BLOCK_REGEXP = /^<style>[\s\S]*?<\/style>\n/;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const storyDocsFixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'story-docs/__testfixtures__'
);
// The manifest declares `beta-label` without a `fieldName`, so the static pass cannot pair the
// `betaLabel` arg with it; the legacy recording got the attribute from runtime reflection.
const DECLARED_OMISSIONS: Record<string, readonly string[]> = {
  'vanilla-multi-definition/ArgsDefaultRender': ['beta-label'],
};

const listFixtureCases = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort()
    : [];

const cases = [
  ...listFixtureCases(fixturesDir).map((fixtureCase) => ({
    fixtureCase,
    testDir: join(fixturesDir, fixtureCase),
    title: `WebComponentsFixtures/${fixtureCase}`,
    legacyParity: true,
  })),
  ...listFixtureCases(storyDocsFixturesDir).map((fixtureCase) => ({
    fixtureCase,
    testDir: join(storyDocsFixturesDir, fixtureCase),
    title: `WebComponentsStoryDocs/${fixtureCase}`,
    legacyParity: false,
  })),
];

type Case = (typeof cases)[number];

const built = new Map<string, ReturnType<typeof build>>();

// Each fixture is built once, for its own test and for the count of filled templates.
const buildOnce = (testCase: Case) => {
  if (!built.has(testCase.fixtureCase)) {
    built.set(testCase.fixtureCase, build(testCase));
  }
  return built.get(testCase.fixtureCase)!;
};

// The args a story is written with, as their values, which is how the preview has them.
const ownArgs = (args: Record<string, ESTreeNode>) =>
  Object.fromEntries(
    Object.entries(args).flatMap(([key, node]) => {
      const value = evaluateArgValue(node);
      return value.kind === 'value' ? [[key, value.value]] : [];
    })
  );

async function build({ testDir, title }: Case) {
  const storyPath = join(testDir, 'input.stories.ts');
  const csf = loadCsf(readFileSync(storyPath, 'utf8'), { makeTitle: () => title }).parse();
  const storyExports = Object.entries(csf._stories);
  const entry: IndexEntry = {
    id: storyExports[0]?.[1].id ?? '',
    name: storyExports[0]?.[1].name ?? storyExports[0]?.[0] ?? '',
    title,
    type: 'story',
    subtype: 'story',
    importPath: storyPath,
  };
  const docgen = createFixtureDocgen(testDir);
  const payload = await buildStoryDocsPayload(
    { entry },
    { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
  );
  // The args as the provider reads them, through the files the story imports.
  const resolver = createStoryArgsResolver(csf, {
    filePath: storyPath,
    resolveModule: createStoryReferenceResolver()().resolveModule,
  });
  // Each template filled once a control changed every arg the story writes, or the error that
  // keeps the static snippet.
  const filled: Record<string, string> = {};
  for (const [exportName, story] of storyExports) {
    const template = payload?.stories[story.id]?.template;
    if (template !== undefined) {
      const initialArgs = ownArgs(resolver.resolve(exportName).args);
      const unmappedArgs = Object.fromEntries(
        Object.entries(initialArgs).map(([key, value]) => [key, changed(value)])
      );
      try {
        filled[exportName] = fillTemplate(
          template as HtmlSnippetTemplate,
          argChanges({ initialArgs, unmappedArgs }),
          printHole
        );
      } catch (error) {
        if (!(error instanceof UnprintableArgError)) {
          throw error;
        }
        filled[exportName] = `${error.name}: ${error.message}`;
      }
    }
  }
  return { storyExports, payload, filled };
}

// A value as a control changes it: a string to one that needs escaping, a number and a boolean to
// another one, and an array or object to one with each of its values changed.
const changed = (value: unknown): unknown =>
  typeof value === 'string'
    ? `${value} & <changed>`
    : typeof value === 'number'
      ? value + 1
      : typeof value === 'boolean'
        ? !value
        : Array.isArray(value)
          ? value.map(changed)
          : typeof value === 'object' && value !== null
            ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, changed(item)]))
            : value;

describe('web-components story-docs server snippets', () => {
  it.each(cases)('$fixtureCase', async (testCase) => {
    const { fixtureCase, testDir, legacyParity } = testCase;
    const { storyExports, payload, filled } = await buildOnce(testCase);
    expect(storyExports.length).toBeGreaterThan(0);
    expect(payload).toBeDefined();

    for (const [exportName, story] of storyExports) {
      const storyDoc = payload!.stories[story.id];
      expect(storyDoc, `${exportName} missing from payload`).toBeDefined();
      expect(storyDoc?.error, `${exportName} produced an error`).toBeUndefined();
      const recorded = [
        storyDoc?.snippet ?? NO_SNIPPET_SENTINEL,
        ...(storyDoc?.warning === undefined ? [] : [`warning: ${storyDoc.warning}`]),
      ].join('\n\n');
      // The snippet of a render function is its own code, which next's html does not describe.
      if (storyDoc?.snippet !== undefined && !storyDoc.snippet.startsWith('<')) {
        await expect(recorded).toMatchFileSnapshot(
          join(testDir, `server-snippet-${exportName}.snapshot`)
        );
        continue;
      }
      await recordServerSnippet({
        framework: 'web-components',
        normalize: (snippet) => snippet.replace(STYLE_BLOCK_REGEXP, ''),
        prefix: 'server-snippet-',
        testDir,
        exportName,
        snippet: storyDoc?.snippet,
        recorded,
        legacyParity,
        declaredOmissions: DECLARED_OMISSIONS[`${fixtureCase}/${exportName}`],
      });
    }

    expectNoStaleSnippets(
      testDir,
      'server-snippet-',
      storyExports.map(([exportName]) => exportName)
    );

    await expect(withReadableTemplates({ ...payload!, path: '__PATH__' })).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
    await expect(filled).toMatchFileSnapshot(join(testDir, 'story-docs.filled.snapshot'));
  });

  it('gives each snippet a template that prints it while no arg changes', async () => {
    const results = await Promise.all(cases.map(buildOnce));
    const stories = results.flatMap(({ storyExports, payload }) =>
      storyExports.map(([, story]) => ({
        id: story.id,
        snippet: payload?.stories[story.id]?.snippet,
        template: payload?.stories[story.id]?.template,
      }))
    );
    const withSnippet = stories.filter((story) => story.snippet !== undefined);
    // A story gets a template where its snippet fills in the args it reads. A snippet the story
    // writes itself, as `parameters.docs.source.code`, reads no arg, and a render that reads the
    // args as a whole, as `Card(args)`, prints args no hole could follow.
    expect(withSnippet.filter((story) => story.template === undefined).map((s) => s.id)).toEqual([
      'webcomponentsstorydocs-csf-shapes--authored-code',
      'webcomponentsstorydocs-lit-helper-shapes--helper-call',
      'webcomponentsstorydocs-lit-helper-shapes--helper-defaults',
      'webcomponentsstorydocs-lit-helper-shapes--helper-in-html',
      'webcomponentsstorydocs-lit-helper-shapes--csf-2-helper',
      'webcomponentsstorydocs-lit-helper-shapes--spread-directive',
      'webcomponentsstorydocs-lit-helper-shapes--spread-next-to-attribute',
      'webcomponentsstorydocs-lit-helper-shapes--branching-helper',
      'webcomponentsstorydocs-lit-template-shapes--aliased',
      'webcomponentsstorydocs-no-component--authored',
    ]);
    expect(
      withSnippet
        .filter(
          (story) => story.template !== undefined && stripHoles(story.template) !== story.snippet
        )
        .map((story) => story.id)
    ).toEqual([]);
  });
});
