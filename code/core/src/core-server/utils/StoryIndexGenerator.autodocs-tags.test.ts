import { join } from 'pathe';

import { describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import type { API_Provider, IndexEntry } from 'storybook/internal/types';

import { transformStoryIndexToStoriesHash } from '../../manager-api/lib/stories.ts';
import { computeStaticFilterFn } from '../../manager-api/modules/tags.ts';
import type { API } from '../../manager-api/root.tsx';
import { Tag } from '../../shared/constants/tags.ts';
import { csfIndexer } from '../presets/common-preset.ts';
import { StoryIndexGenerator } from './StoryIndexGenerator.ts';

vi.mock('storybook/internal/node-logger');

type Project = 'default-project' | 'autodocs-project';

const tagsOf = (entry: IndexEntry | undefined) => entry?.tags?.join(', ') ?? null;

const storiesShownByStoriesBlock = (stories: IndexEntry[]) => {
  const tagged = stories.filter((story) => story.tags?.includes(Tag.AUTODOCS));
  return (tagged.length > 0 ? tagged : stories).map((story) => story.name).join(', ');
};

async function indexFiles(project: Project, files: string[]) {
  const projectDir = join(__dirname, '__mockdata__', 'autodocs-tags', project);
  const dirs = { configDir: projectDir, workingDir: projectDir };
  const generator = new StoryIndexGenerator(
    files.map((file) => normalizeStoriesEntry(`./${file}`, dirs)),
    { ...dirs, indexers: [csfIndexer], docs: { defaultName: 'Docs' } }
  );
  await generator.initialize();
  return generator.getIndex();
}

async function recordAutodocs(project: Project, storiesFile: string) {
  const index = await indexFiles(project, [`${storiesFile}.stories.ts`]);

  const entries = Object.values(index.entries);
  const stories = entries.filter((entry) => entry.type === 'story');
  const autodocs = entries.find((entry) => entry.type === 'docs');

  const sidebar = Object.values(
    transformStoryIndexToStoriesHash(index, {
      provider: { getConfig: () => ({}) } as API_Provider<API>,
      docsOptions: {},
      filters: { static: computeStaticFilterFn({}) },
      allStatuses: {},
    })
  );
  const sidebarLeaves = sidebar.filter((entry) => entry.type === 'docs' || entry.type === 'story');
  const component = sidebar.find((entry) => entry.type === 'component');

  return {
    autodocsCreated: !!autodocs,
    autodocsTags: tagsOf(autodocs),
    autodocsInSidebar: sidebarLeaves.some((entry) => entry.id === autodocs?.id),
    storyTags: Object.fromEntries(stories.map((story) => [story.name, tagsOf(story)])),
    sidebarEntries: sidebarLeaves.map((entry) => entry.name).join(', ') || null,
    sidebarComponentTags: component ? component.tags.join(', ') : null,
    storiesOnDocsPage: autodocs ? storiesShownByStoriesBlock(stories) : null,
  };
}

describe('autodocs entry of a CSF file', () => {
  it('A: autodocs only in meta', async () => {
    expect(await recordAutodocs('default-project', 'A-tag-only-in-meta')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "sidebarComponentTags": "dev, test, manifest, autodocs",
        "sidebarEntries": "Docs, Story 1, Story 2",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "dev, test, manifest, autodocs",
          "Story 2": "dev, test, manifest, autodocs",
        },
      }
    `);
  });

  it('B: autodocs in all stories', async () => {
    expect(await recordAutodocs('default-project', 'B-tag-in-all-stories')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "sidebarComponentTags": "dev, test, manifest, autodocs",
        "sidebarEntries": "Docs, Story 1, Story 2",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "dev, test, manifest, autodocs",
          "Story 2": "dev, test, manifest, autodocs",
        },
      }
    `);
  });

  it('C: autodocs in some stories', async () => {
    expect(await recordAutodocs('default-project', 'C-tag-in-some-stories')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "sidebarComponentTags": "dev, test, manifest",
        "sidebarEntries": "Docs, Story 1, Story 2",
        "storiesOnDocsPage": "Story 2",
        "storyTags": {
          "Story 1": "dev, test, manifest",
          "Story 2": "dev, test, manifest, autodocs",
        },
      }
    `);
  });

  it('D: autodocs inherited from project', async () => {
    expect(await recordAutodocs('autodocs-project', 'D-tag-inherited-from-project'))
      .toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "sidebarComponentTags": "dev, test, manifest, autodocs",
        "sidebarEntries": "Docs, Story 1, Story 2",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "dev, test, manifest, autodocs",
          "Story 2": "dev, test, manifest, autodocs",
        },
      }
    `);
  });

  it('E: first story excluded from autodocs', async () => {
    expect(await recordAutodocs('default-project', 'E-first-story-excluded'))
      .toMatchInlineSnapshot(`
        {
          "autodocsCreated": true,
          "autodocsInSidebar": true,
          "autodocsTags": "dev, test, manifest, autodocs",
          "sidebarComponentTags": "dev, test, manifest",
          "sidebarEntries": "Docs, Story 1, Story 2",
          "storiesOnDocsPage": "Story 2",
          "storyTags": {
            "Story 1": "dev, test, manifest",
            "Story 2": "dev, test, manifest, autodocs",
          },
        }
      `);
  });

  it('F: autodocs inherited from project but all stories excluded', async () => {
    expect(await recordAutodocs('autodocs-project', 'F-inherited-but-all-stories-excluded'))
      .toMatchInlineSnapshot(`
      {
        "autodocsCreated": false,
        "autodocsInSidebar": false,
        "autodocsTags": null,
        "sidebarComponentTags": "dev, test, manifest",
        "sidebarEntries": "Story 1, Story 2",
        "storiesOnDocsPage": null,
        "storyTags": {
          "Story 1": "dev, test, manifest",
          "Story 2": "dev, test, manifest",
        },
      }
    `);
  });

  it('G: stories remove dev and manifest under project autodocs', async () => {
    expect(await recordAutodocs('autodocs-project', 'G-story-tag-inheritance'))
      .toMatchInlineSnapshot(`
        {
          "autodocsCreated": true,
          "autodocsInSidebar": true,
          "autodocsTags": "test, autodocs",
          "sidebarComponentTags": "test, autodocs",
          "sidebarEntries": "Docs, Story 2",
          "storiesOnDocsPage": "Story 1, Story 2",
          "storyTags": {
            "Story 1": "test, autodocs",
            "Story 2": "dev, test, autodocs",
          },
        }
      `);
  });

  it('H: first story removes dev and manifest', async () => {
    expect(await recordAutodocs('default-project', 'H-first-story-hidden')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "test, autodocs",
        "sidebarComponentTags": "test, autodocs",
        "sidebarEntries": "Docs, Story 2",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "test, autodocs",
          "Story 2": "dev, test, manifest, autodocs",
        },
      }
    `);
  });

  it('I: last story removes dev and manifest', async () => {
    expect(await recordAutodocs('default-project', 'I-last-story-hidden')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "test, autodocs",
        "sidebarComponentTags": "test, autodocs",
        "sidebarEntries": "Docs, Story 1",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "dev, test, manifest, autodocs",
          "Story 2": "test, autodocs",
        },
      }
    `);
  });

  it('J: meta removes dev to make a docs-only component', async () => {
    expect(await recordAutodocs('default-project', 'J-docs-only-component')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "test, manifest, autodocs",
        "sidebarComponentTags": "test, manifest, autodocs",
        "sidebarEntries": "Docs",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "test, manifest, autodocs",
          "Story 2": "test, manifest, autodocs",
        },
      }
    `);
  });

  it('rejects an MDX docs page that replaces it when only some stories have autodocs', async () => {
    const error = await indexFiles('default-project', [
      'C-tag-in-some-stories.stories.ts',
      'C-tag-in-some-stories.mdx',
    ]).catch((thrown) => thrown);

    expect(String(error)).toContain("but also tagged the CSF file with 'autodocs'");
  });

  it('ignores the stories of a subcomponent', async () => {
    const index = await indexFiles('default-project', [
      'K-parent.stories.ts',
      'K-subcomponent.stories.ts',
    ]);

    const docsEntries = Object.values(index.entries).filter((entry) => entry.type === 'docs');
    expect(docsEntries.map((entry) => [entry.title, tagsOf(entry)])).toEqual([
      ['K-parent', 'dev, test, manifest, autodocs'],
    ]);
  });
});
