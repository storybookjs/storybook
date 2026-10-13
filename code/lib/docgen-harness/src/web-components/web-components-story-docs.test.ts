import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createStoryArgsResolver, loadCsf } from 'storybook/internal/csf-tools';
import { UnprintableArgError } from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { evaluateArgValue } from '../../../../renderers/web-components/src/docgen/story-docs/arg-values.ts';
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

// The story's args as the preview has them, when the static pass can read them all.
const staticArgs = (nodes: Record<string, Parameters<typeof evaluateArgValue>[0]>) => {
  const args: Record<string, unknown> = {};
  for (const [name, node] of Object.entries(nodes)) {
    const value = evaluateArgValue(node);
    if (value.kind === 'unresolved') {
      return undefined;
    }
    args[name] =
      value.kind === 'function' ? () => {} : value.kind === 'value' ? value.value : undefined;
  }
  return args;
};

let filled = 0;

describe('web-components story-docs server snippets', () => {
  it.each(cases)('$fixtureCase', async ({ fixtureCase, testDir, title, legacyParity }) => {
    const storyPath = join(testDir, 'input.stories.ts');
    const csf = loadCsf(readFileSync(storyPath, 'utf8'), { makeTitle: () => title }).parse();
    const storyExports = Object.entries(csf._stories);
    expect(storyExports.length).toBeGreaterThan(0);

    const entry: IndexEntry = {
      id: storyExports[0][1].id,
      name: storyExports[0][1].name ?? storyExports[0][0],
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
    expect(payload).toBeDefined();

    const resolver = createStoryArgsResolver(csf);
    for (const [exportName, story] of storyExports) {
      const storyDoc = payload!.stories[story.id];
      const args = staticArgs(resolver.resolve(exportName).args);
      if (storyDoc?.template !== undefined && args !== undefined) {
        try {
          fillTemplate(storyDoc.template, args);
          filled += 1;
        } catch (error) {
          // A function in a value hole, such as a nested listener, keeps the static snippet.
          expect(error, `${exportName} fills`).toBeInstanceOf(UnprintableArgError);
        }
      }
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
  });

  it('fills a meaningful number of templates with their story args', () => {
    expect(filled).toBeGreaterThan(20);
  });
});
