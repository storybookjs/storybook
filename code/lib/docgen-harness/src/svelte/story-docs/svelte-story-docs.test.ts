import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { storyNameFromExport, toId } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../renderers/svelte/src/docgen/story-docs/build-story-docs.ts';
import { createIndexer } from '../../../../../renderers/svelte/src/svelte-csf/indexer/index.ts';
import { expectCurrentOrBetter } from '../../compare/expect-current-or-better.ts';
import {
  expectNoStaleSnippets,
  NO_SNIPPET_SENTINEL,
  recordServerSnippet,
} from '../../compare/server-snippet-recorder.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../__testfixtures__');
const indexer = createIndexer();

const cases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .flatMap((fixtureCase) =>
    ['svelte', 'ts']
      .filter((extension) =>
        existsSync(join(fixturesDir, fixtureCase, `input.stories.${extension}`))
      )
      .map((extension) => ({
        fixtureCase,
        extension,
        testDir: join(fixturesDir, fixtureCase),
        prefix: extension === 'svelte' ? 'osa-snippet-' : 'osa-plain-csf-snippet-',
        legacyPrefix: extension === 'svelte' ? 'snippet-' : 'plain-csf-snippet-',
      }))
  );

const indexedCases = await Promise.all(
  cases.map(async (fixture) => {
    const storyPath = join(fixture.testDir, `input.stories.${fixture.extension}`);
    const stories =
      fixture.extension === 'svelte'
        ? (
            await indexer.createIndex(storyPath, {
              makeTitle: (title) => title ?? fixture.fixtureCase,
            })
          ).map((story) => {
            if (!story.title || !story.exportName) {
              throw new Error(`${storyPath}: every story must have a title and export name`);
            }
            return {
              id: toId(story.metaId ?? story.title, storyNameFromExport(story.exportName)),
              title: story.title,
              exportName: story.exportName,
              name: story.name ?? story.exportName,
            };
          })
        : (() => {
            const csf = loadCsf(readFileSync(storyPath, 'utf8'), {
              makeTitle: (title) => title ?? fixture.fixtureCase,
            }).parse();
            const title = csf.meta.title;
            if (!title) {
              throw new Error(`${storyPath}: meta must have a title`);
            }
            return Object.entries(csf._stories).map(([exportName, story]) => ({
              id: story.id,
              title,
              exportName,
              name: story.name ?? exportName,
            }));
          })();
    return { ...fixture, storyPath, stories };
  })
);

describe('svelte story-docs server snippets', () => {
  it.each(indexedCases)(
    '$fixtureCase ($extension)',
    async ({ testDir, storyPath, stories, prefix, legacyPrefix }) => {
      expect(stories.length).toBeGreaterThan(0);
      for (const story of stories) {
        const entry: IndexEntry = {
          id: story.id,
          name: story.name,
          title: story.title,
          type: 'story',
          subtype: 'story',
          importPath: storyPath,
        };
        const payload = await buildStoryDocsPayload({ entry });
        const storyDoc = payload?.stories[story.id];
        expect(payload?.import).toBeUndefined();
        expect(storyDoc?.snippet).toMatch(/^<script(?: lang="ts")?>\n/);
        if (payload !== undefined) {
          expect(storyDoc, `${story.exportName} missing from payload`).toBeDefined();
        }
        expect(storyDoc?.error, `${story.exportName} produced an error`).toBeUndefined();
        await recordServerSnippet({
          framework: 'svelte',
          testDir,
          prefix,
          legacyPrefix,
          exportName: story.exportName,
          snippet: storyDoc?.snippet,
          recorded: [
            storyDoc?.snippet ?? NO_SNIPPET_SENTINEL,
            ...(storyDoc?.warning === undefined ? [] : [`warning: ${storyDoc.warning}`]),
          ].join('\n\n'),
          legacyParity: true,
        });
      }
      expectNoStaleSnippets(
        testDir,
        prefix,
        stories.map((story) => story.exportName)
      );
    }
  );
});

it('every story has its legacy and server snippet baselines', () => {
  for (const { testDir, stories, prefix, legacyPrefix } of indexedCases) {
    for (const { exportName } of stories) {
      for (const filePrefix of [prefix, legacyPrefix]) {
        const path = join(testDir, `${filePrefix}${exportName}.snapshot`);
        expect(existsSync(path), path).toBe(true);
      }
    }
  }
});

describe('svelte server snippets hold the legacy baseline', () => {
  for (const { fixtureCase, extension, testDir, stories, prefix, legacyPrefix } of indexedCases) {
    for (const { exportName } of stories) {
      it(`${fixtureCase}/${exportName} (${extension})`, () => {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'svelte',
          baseline: readFileSync(join(testDir, `${legacyPrefix}${exportName}.snapshot`), 'utf8'),
          candidate: readFileSync(join(testDir, `${prefix}${exportName}.snapshot`), 'utf8'),
        });
      });
    }
  }
});

it.each([
  ['story-identifiers.stories.svelte', 'identifiers'],
  ['story-meta-id.stories.svelte', 'custom-id'],
])('keys server snippets by indexed IDs in %s', async (filename, metaId) => {
  const storyPath = join(dirname(fileURLToPath(import.meta.url)), `__fixtures__/${filename}`);
  const indexed = await indexer.createIndex(storyPath, {
    makeTitle: (title) => title ?? 'Identifiers',
  });
  expect(
    indexed.map((story) =>
      toId(
        story.metaId ?? story.title ?? 'Identifiers',
        storyNameFromExport(story.exportName ?? '')
      )
    )
  ).toEqual([`${metaId}--icon-before`, `${metaId}--explicit-export-name`]);
  const payload = await buildStoryDocsPayload({
    entry: {
      id: `${metaId}--icon-before`,
      name: 'Icon before',
      title: 'Identifiers',
      type: 'story',
      subtype: 'story',
      importPath: storyPath,
    },
  });
  expect(Object.keys(payload?.stories ?? {})).toEqual([
    `${metaId}--icon-before`,
    `${metaId}--explicit-export-name`,
  ]);
  expect(payload?.stories[`${metaId}--icon-before`]?.snippet).toContain('label="Download"');
  expect(payload?.stories[`${metaId}--explicit-export-name`]?.snippet).toContain(
    'label="Explicit"'
  );
});

it('keeps every story payload when block bindings are destructured', async () => {
  const payload = await buildStoryDocsPayload({
    entry: {
      id: 'destructuring--sibling',
      name: 'Sibling',
      title: 'Destructuring',
      type: 'story',
      subtype: 'story',
      importPath: join(
        dirname(fileURLToPath(import.meta.url)),
        '__fixtures__/destructured-bindings.stories.svelte'
      ),
    },
  });
  expect(Object.values(payload?.stories ?? {})).toHaveLength(7);
  expect(payload?.stories['destructuring--sibling']?.snippet).toContain('label="Sibling"');
  for (const story of Object.values(payload?.stories ?? {})) {
    expect(story.snippet).toBeDefined();
    expect(story.warning ?? '').not.toContain('`name`');
  }
});
