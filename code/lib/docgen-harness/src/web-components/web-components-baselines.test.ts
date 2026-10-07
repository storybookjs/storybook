// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import {
  extractArgTypes,
  extractComponentDescription,
} from '../../../../renderers/web-components/src/docs/custom-elements.ts';
import { renderStorySource } from '../../../../renderers/web-components/src/docs/sourceDecorator.ts';
import { setCustomElementsManifest } from '../../../../renderers/web-components/src/framework-api.ts';
import { render as defaultRender } from '../../../../renderers/web-components/src/render.ts';
import type { WebComponentsRenderer } from '../../../../renderers/web-components/src/types.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';
import type { Meta, Story } from './csf-types.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'web-components-baselines.test.ts records the legacy custom-elements manifest path; update the recorder or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// The unprefixed custom-elements.json is the analyzer's 1.0.0 capture; these are hand-written shapes recorded under a prefix.
const MANIFEST_VARIANTS = ['v2', 'wca', 'unflattened'] as const;

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

afterEach(() => {
  setCustomElementsManifest(undefined);
  vi.unstubAllGlobals();
});

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

function serializeLastRootElement(snippet: string): string {
  const template = document.createElement('template');
  template.innerHTML = snippet;
  return template.content.lastElementChild?.outerHTML ?? snippet;
}

function serializeGateCandidate(storyResult: WebComponentsRenderer['storyResult']): string {
  if (storyResult instanceof DocumentFragment) {
    const element = storyResult.lastElementChild;
    return element ? renderStorySource(element) : '';
  }

  return renderStorySource(storyResult);
}

async function recordSnippet(
  prefix: '' | 'osa-',
  testDir: string,
  exportName: string,
  storyResult: WebComponentsRenderer['storyResult']
): Promise<void> {
  const snippetPath = join(testDir, `${prefix}snippet-${exportName}.snapshot`);
  const snippet = renderStorySource(storyResult);

  if (prefix === 'osa-') {
    const candidate = serializeGateCandidate(storyResult);
    expectCurrentOrBetter({
      kind: 'snippet',
      framework: 'web-components',
      baseline: serializeLastRootElement(
        readFileSync(join(testDir, `snippet-${exportName}.snapshot`), 'utf8')
      ),
      candidate,
    });

    const committedSnippet = readCommitted(snippetPath);
    if (committedSnippet !== undefined) {
      // Under `-u` the file snapshot rewrites itself, so this gate is what stops a regression from being recorded.
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'web-components',
        baseline: serializeLastRootElement(committedSnippet),
        candidate,
      });
    }
  } else {
    const committedSnippet = readCommitted(snippetPath);
    if (committedSnippet !== undefined) {
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'web-components',
        baseline: committedSnippet,
        candidate: snippet,
      });
    }
  }

  await expect(snippet).toMatchFileSnapshot(snippetPath);
}

describe('web-components legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const manifest = JSON.parse(readFileSync(join(testDir, 'custom-elements.json'), 'utf8'));
    setCustomElementsManifest(manifest);

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule as { default: Meta } & Record<
      string,
      Story
    >;
    const tagName = meta.component;

    const recordArgTypes = async (filePrefix: string) => {
      const path = join(testDir, `${filePrefix}argtypes.snapshot`);
      const label = `${fixtureCase}/${filePrefix}argtypes.snapshot`;
      const argTypes = extractArgTypes(tagName);
      expect(argTypes, `${label}: no manifest declaration found for ${tagName}`).not.toBeNull();
      if (argTypes == null) {
        throw new Error(`${label}: no manifest declaration found for ${tagName}`);
      }
      await recordArgTypesSnapshot({
        path,
        label,
        candidate: argTypes as StrictArgTypes,
      });
    };

    await recordArgTypes('');

    const description = extractComponentDescription(tagName) ?? '';
    await expect(description).toMatchFileSnapshot(join(testDir, 'description.snapshot'));

    for (const variant of MANIFEST_VARIANTS) {
      const variantManifestPath = join(testDir, `custom-elements.${variant}.json`);
      if (!existsSync(variantManifestPath)) {
        continue;
      }

      const variantManifest = JSON.parse(readFileSync(variantManifestPath, 'utf8'));
      setCustomElementsManifest(variantManifest);

      await recordArgTypes(`${variant}-`);

      const variantDescription = extractComponentDescription(tagName) ?? '';
      await expect(variantDescription).toMatchFileSnapshot(
        join(testDir, `${variant}-description.snapshot`)
      );
    }

    for (const [exportName, story] of Object.entries(stories)) {
      const args = { ...meta.args, ...story.args };
      const context = {
        id: `${fixtureCase}--${exportName}`,
        component: tagName,
      } as StoryContext<WebComponentsRenderer>;
      const storyRender = story.render ?? meta.render;
      const storyResult = storyRender ? storyRender(args) : defaultRender(args, context);
      await recordSnippet(
        '',
        testDir,
        exportName,
        storyResult as WebComponentsRenderer['storyResult']
      );
    }

    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedSnippetFiles = Object.keys(stories)
      .map((exportName) => `snippet-${exportName}.snapshot`)
      .sort();
    expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
  });
});

describe('web-components default render with docgenServer', () => {
  beforeEach(() => {
    vi.stubGlobal('FEATURES', { docgenServer: true });
  });

  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule as { default: Meta } & Record<
      string,
      Story
    >;
    const tagName = meta.component;
    const defaultRenderStories = Object.entries(stories).filter(
      ([, story]) => !story.render && !meta.render
    );

    for (const [exportName, story] of defaultRenderStories) {
      const context = {
        id: `${fixtureCase}--${exportName}`,
        component: tagName,
      } as StoryContext<WebComponentsRenderer>;
      await recordSnippet(
        'osa-',
        testDir,
        exportName,
        defaultRender(
          { ...meta.args, ...story.args },
          context
        ) as WebComponentsRenderer['storyResult']
      );
    }

    const osaSnippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('osa-snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedOsaSnippetFiles = defaultRenderStories
      .map(([exportName]) => `osa-snippet-${exportName}.snapshot`)
      .sort();
    expect(osaSnippetFilesOnDisk).toEqual(expectedOsaSnippetFiles);
  });
});
