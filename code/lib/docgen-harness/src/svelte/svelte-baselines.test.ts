// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import type {
  AnnotatedStoryFn,
  Args,
  StoryAnnotations,
  StoryContext,
  StrictArgTypes,
} from 'storybook/internal/types';

import { flushSync } from 'svelte';
import type { Component } from 'svelte';

import {
  createTestChannel,
  installTestChannel,
} from '../../../../core/src/channels/test-channel.ts';
import { extractArgTypes } from '../../../../renderers/svelte/src/extractArgTypes.ts';
import { extractComponentDescription } from '../../../../renderers/svelte/src/extractComponentDescription.ts';
import { generateSvelteSource } from '../../../../renderers/svelte/src/docs/sourceDecorator.ts';
import {
  composeStory,
  setProjectAnnotations,
} from '../../../../renderers/svelte/src/portable-stories.ts';
import type { SvelteRenderer } from '../../../../renderers/svelte/src/types.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'svelte-baselines.test.ts records the legacy svelte-vite docgen path; update the recorder or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const CHANNEL_WAIT_MS = 1000;

const channel = createTestChannel();
installTestChannel(channel);
setProjectAnnotations([]);

type ComponentWithDocgen = Component & {
  __docgen?: unknown;
};

type SvelteMeta = {
  component: ComponentWithDocgen;
  args?: Args;
  title?: string;
};

type SvelteStoryObject = StoryAnnotations<SvelteRenderer, Args> & {
  component?: ComponentWithDocgen;
};

type SvelteStory = AnnotatedStoryFn<SvelteRenderer, Args> | SvelteStoryObject;

type SvelteStoriesModule = { default: SvelteMeta } & Record<string, unknown>;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('svelte legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storiesModule = (await import(
      `./__testfixtures__/${fixtureCase}/input.stories.svelte`
    )) as SvelteStoriesModule;
    const { default: meta, ...exports } = storiesModule;
    const stories = Object.fromEntries(
      Object.entries(exports).filter(([, value]) => isStoryExport(value))
    ) as Record<string, SvelteStory>;
    const plainStoriesPath = join(testDir, 'input.stories.ts');
    const plainStoriesModule = existsSync(plainStoriesPath)
      ? ((await import(
          `./__testfixtures__/${fixtureCase}/input.stories.ts`
        )) as SvelteStoriesModule)
      : undefined;
    const plainStories = plainStoriesModule
      ? (Object.fromEntries(
          Object.entries(plainStoriesModule).filter(
            ([exportName, value]) => exportName !== 'default' && isStoryExport(value)
          )
        ) as Record<string, SvelteStory>)
      : {};
    const component = meta.component;

    expect(
      component.__docgen,
      `${fixtureCase}/argtypes.snapshot: __docgen missing; svelteDocgen() did not run`
    ).toBeDefined();

    const argTypes = extractArgTypes(component as Parameters<typeof extractArgTypes>[0]);
    await recordArgTypesSnapshot({
      path: join(testDir, 'argtypes.snapshot'),
      label: `${fixtureCase}/argtypes.snapshot`,
      candidate: argTypes as StrictArgTypes,
    });

    const description = extractComponentDescription(component);
    await expect(description).toMatchFileSnapshot(join(testDir, 'description.snapshot'));

    for (const [exportName, story] of Object.entries(stories)) {
      const snippet = await generateSvelteCsfSnippet(meta, story, exportName, fixtureCase);
      const snippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const committedSnippet = existsSync(snippetPath)
        ? readFileSync(snippetPath, 'utf8')
        : undefined;
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'svelte',
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
      await expect(snippet).toMatchFileSnapshot(snippetPath);
    }

    if (plainStoriesModule) {
      for (const [exportName, story] of Object.entries(plainStories)) {
        const args = { ...plainStoriesModule.default.args, ...story.args };
        const snippetComponent = getPlainCsfSnippetComponent(
          plainStoriesModule.default,
          story,
          args
        );
        const snippet = generateSvelteSource(
          snippetComponent,
          args,
          argTypes as StrictArgTypes,
          null
        );
        expect(snippet, `${fixtureCase}/plain-csf-snippet-${exportName}.snapshot`).not.toBeNull();
        if (snippet === null) {
          throw new Error(
            `${fixtureCase}/plain-csf-snippet-${exportName}.snapshot: snippet missing`
          );
        }
        const snippetPath = join(testDir, `plain-csf-snippet-${exportName}.snapshot`);
        const committedSnippet = existsSync(snippetPath)
          ? readFileSync(snippetPath, 'utf8')
          : undefined;
        if (committedSnippet !== undefined) {
          expectCurrentOrBetter({
            kind: 'snippet',
            framework: 'svelte',
            baseline: committedSnippet,
            candidate: snippet,
          });
        }
        await expect(snippet).toMatchFileSnapshot(snippetPath);
      }
    }

    expectSnapshotFiles(testDir, 'snippet-', Object.keys(stories));
    expectSnapshotFiles(testDir, 'plain-csf-snippet-', Object.keys(plainStories));
  });
});

function isStoryExport(value: unknown): value is SvelteStory {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    ('args' in value || 'parameters' in value || 'render' in value || 'tags' in value)
  );
}

async function generateSvelteCsfSnippet(
  meta: SvelteMeta,
  story: SvelteStory,
  exportName: string,
  fixtureCase: string
): Promise<string> {
  const Story = composeStory(story, meta, undefined, exportName);
  const snippetRendered = waitForSnippetRendered(fixtureCase, exportName, Story.id);
  const canvasElement = document.createElement('div');
  document.body.appendChild(canvasElement);

  try {
    await Story.run({ canvasElement });
    flushSync();
    return await snippetRendered;
  } finally {
    cleanup();
    document.body.replaceChildren();
  }
}

function waitForSnippetRendered(
  fixtureCase: string,
  exportName: string,
  storyId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      channel.off(SNIPPET_RENDERED, handleSnippetRendered);
      reject(
        new Error(
          `${fixtureCase}/snippet-${exportName}.snapshot: timed out waiting for ${SNIPPET_RENDERED} for ${storyId}`
        )
      );
    }, CHANNEL_WAIT_MS);

    const handleSnippetRendered = ({ id, source }: { id?: string; source?: string }) => {
      if (id !== storyId) {
        return;
      }
      clearTimeout(timeout);
      channel.off(SNIPPET_RENDERED, handleSnippetRendered);
      if (source === undefined) {
        reject(
          new Error(
            `${fixtureCase}/snippet-${exportName}.snapshot: ${SNIPPET_RENDERED} for ${storyId} did not include source`
          )
        );
        return;
      }
      resolve(source);
    };

    channel.on(SNIPPET_RENDERED, handleSnippetRendered);
  });
}

function getPlainCsfSnippetComponent(
  meta: SvelteMeta,
  story: SvelteStory,
  args: Args
): ComponentWithDocgen {
  const context = { args } as StoryContext<SvelteRenderer, Args>;

  if (typeof story === 'function') {
    const rendered = story(args, context);
    return rendered.Component ?? meta.component;
  }

  if (story.component) {
    return story.component;
  }

  if (story.render) {
    const rendered = story.render(args, context);
    if (rendered.Component) {
      return rendered.Component;
    }
  }

  return meta.component;
}

function expectSnapshotFiles(testDir: string, prefix: string, exportNames: string[]): void {
  const snippetFilesOnDisk = readdirSync(testDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.snapshot'))
    .sort();
  const expectedSnippetFiles = exportNames
    .map((exportName) => `${prefix}${exportName}.snapshot`)
    .sort();
  expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
}
