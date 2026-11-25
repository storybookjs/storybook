import { join } from 'pathe';

import { describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import type { API_Provider, IndexEntry } from 'storybook/internal/types';

import { selectComponentEntriesByComponentId } from '../../common/utils/select-component-entry.ts';
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

async function recordAutodocs(project: Project, storiesFile: string) {
  const projectDir = join(__dirname, '__mockdata__', 'autodocs-tags', project);
  const dirs = { configDir: projectDir, workingDir: projectDir };
  const generator = new StoryIndexGenerator(
    [normalizeStoriesEntry(`./${storiesFile}.stories.ts`, dirs)],
    { ...dirs, indexers: [csfIndexer], docs: { defaultName: 'Docs' } }
  );
  await generator.initialize();
  const index = await generator.getIndex();

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

  const manifestEntries = entries.filter((entry) => entry.tags?.includes(Tag.MANIFEST));

  return {
    autodocsCreated: !!autodocs,
    autodocsTags: tagsOf(autodocs),
    autodocsInSidebar: sidebarLeaves.some((entry) => entry.id === autodocs?.id),
    autodocsPassesManifestFilter: manifestEntries.some((entry) => entry.id === autodocs?.id),
    storyTags: Object.fromEntries(stories.map((story) => [story.name, tagsOf(story)])),
    sidebarEntries: sidebarLeaves.map((entry) => entry.name).join(', ') || null,
    sidebarComponentTags: component ? component.tags.join(', ') : null,
    componentInManifest: selectComponentEntriesByComponentId(manifestEntries).size > 0,
    storiesOnDocsPage: autodocs ? storiesShownByStoriesBlock(stories) : null,
  };
}

describe('autodocs entry of a CSF file', () => {
  it('A: autodocs only in meta', async () => {
    expect(await recordAutodocs('default-project', 'A-tag-only-in-meta')).toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
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
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
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
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
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
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
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
          "autodocsPassesManifestFilter": true,
          "autodocsTags": "dev, test, manifest, autodocs",
          "componentInManifest": true,
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
        "autodocsPassesManifestFilter": false,
        "autodocsTags": null,
        "componentInManifest": true,
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
          "autodocsPassesManifestFilter": false,
          "autodocsTags": "dev, test, autodocs",
          "componentInManifest": false,
          "sidebarComponentTags": "dev, test, autodocs",
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
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
        "sidebarComponentTags": "dev, test, manifest, autodocs",
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
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "componentInManifest": true,
        "sidebarComponentTags": "dev, test, manifest, autodocs",
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
        "autodocsInSidebar": false,
        "autodocsPassesManifestFilter": true,
        "autodocsTags": "test, manifest, autodocs",
        "componentInManifest": true,
        "sidebarComponentTags": null,
        "sidebarEntries": null,
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "test, manifest, autodocs",
          "Story 2": "test, manifest, autodocs",
        },
      }
    `);
  });
});
