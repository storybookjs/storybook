import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createStoryArgsResolver, fillWithStoryArgs, loadCsf } from 'storybook/internal/csf-tools';
import { UnprintableArgError } from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../renderers/web-components/src/docgen/story-docs/build-story-docs.ts';
import { fillTemplate } from '../../../../renderers/web-components/src/docs/fill-template.ts';
import { createFixtureDocgen } from './story-docs/docgen-fixture.ts';
import {
  expectNoStaleSnippets,
  NO_SNIPPET_SENTINEL,
  recordServerSnippet,
} from './story-docs/snippet-recorder.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const storyDocsFixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'story-docs/__testfixtures__'
);
// The manifest declares `beta-label` without a `fieldName`, so the static pass cannot pair the
// `betaLabel` arg with it; the legacy recording got the attribute from runtime reflection.
const DECLARED_OMISSIONS: Record<string, readonly string[]> = {
  'vanilla-multi-definition/ArgsDefaultRender': ['beta-label'],
  'vanilla-multi-definition/DomNode': ['beta-label'],
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
  const resolver = createStoryArgsResolver(csf);
  // Each template filled with the args of its story as the preview has them before a control
  // changes, each written as its code, or the error that keeps the static snippet.
  const filled: Record<string, string> = {};
  for (const [exportName, story] of storyExports) {
    const template = payload?.stories[story.id]?.template;
    if (template !== undefined) {
      try {
        filled[exportName] = fillWithStoryArgs(
          template,
          resolver.resolve(exportName).args,
          fillTemplate
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
      await recordServerSnippet({
        testDir,
        exportName,
        snippet: storyDoc?.snippet,
        recorded,
        legacyParity,
        declaredOmissions: DECLARED_OMISSIONS[`${fixtureCase}/${exportName}`],
        ownCode: storyDoc?.snippet !== undefined && storyDoc.snippet === filled[exportName],
      });
    }

    expectNoStaleSnippets(
      testDir,
      'server-snippet-',
      storyExports.map(([exportName]) => exportName)
    );

    await expect({ ...payload, path: '__PATH__' }).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
    await expect(filled).toMatchFileSnapshot(join(testDir, 'story-docs.filled.snapshot'));
  });

  it('fills a meaningful number of templates with their story args', async () => {
    const results = await Promise.all(cases.map(buildOnce));
    const filled = results.flatMap((result) => Object.values(result.filled));
    expect(filled.filter((text) => !text.startsWith('UnprintableArgError')).length).toBeGreaterThan(
      20
    );
  });
});
