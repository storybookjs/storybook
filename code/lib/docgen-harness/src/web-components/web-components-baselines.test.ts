// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

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

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

afterEach(() => {
  setCustomElementsManifest(undefined);
});

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

    const argTypes = extractArgTypes(tagName);
    await recordArgTypesSnapshot({
      path: join(testDir, 'argtypes.snapshot'),
      label: `${fixtureCase}/argtypes.snapshot`,
      candidate: (argTypes ?? {}) as StrictArgTypes,
    });

    const description = extractComponentDescription(tagName) ?? '';
    await expect(description).toMatchFileSnapshot(join(testDir, 'description.snapshot'));

    for (const [exportName, story] of Object.entries(stories)) {
      const args = { ...meta.args, ...story.args };
      const context = {
        id: `${fixtureCase}--${exportName}`,
        title: meta.title,
        name: exportName,
        component: tagName,
        args,
      } as StoryContext<WebComponentsRenderer>;
      const storyRender = story.render ?? meta.render;
      const storyResult = storyRender ? storyRender(args) : defaultRender(args, context);
      const snippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const committedSnippet = existsSync(snippetPath)
        ? readFileSync(snippetPath, 'utf8')
        : undefined;
      const snippet = renderStorySource(storyResult as WebComponentsRenderer['storyResult']);
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'web-components',
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
      await expect(snippet).toMatchFileSnapshot(snippetPath);
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
