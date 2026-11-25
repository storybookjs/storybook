import { join } from 'pathe';

import { describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import type { API_Provider, IndexEntry, StoryIndex } from 'storybook/internal/types';

import { transformStoryIndexToStoriesHash } from '../../manager-api/lib/stories.ts';
import { computeStaticFilterFn } from '../../manager-api/modules/tags.ts';
import type { API } from '../../manager-api/root.tsx';
import { Tag } from '../../shared/constants/tags.ts';
import { csfIndexer } from '../presets/common-preset.ts';
import { StoryIndexGenerator } from './StoryIndexGenerator.ts';

vi.mock('storybook/internal/node-logger');

type Project = 'default-project' | 'autodocs-project';

const tagsOf = (entry: IndexEntry | undefined) => entry?.tags?.join(', ') ?? null;

const isAttachedMdx = (entry: IndexEntry) => entry.tags?.includes(Tag.ATTACHED_MDX) ?? false;

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

function sidebarOf(index: StoryIndex) {
  const sidebar = Object.values(
    transformStoryIndexToStoriesHash(index, {
      provider: { getConfig: () => ({}) } as API_Provider<API>,
      docsOptions: {},
      filters: { static: computeStaticFilterFn({}) },
      allStatuses: {},
    })
  );
  const leaves = sidebar.filter((entry) => entry.type === 'docs' || entry.type === 'story');
  const component = sidebar.find((entry) => entry.type === 'component');
  return {
    has: (entry: IndexEntry | undefined) => leaves.some((leaf) => leaf.id === entry?.id),
    entries: leaves.map((entry) => entry.name).join(', ') || null,
    componentTags: component ? component.tags.join(', ') : null,
  };
}

async function recordAutodocs(project: Project, storiesFile: string, extension = 'ts') {
  const index = await indexFiles(project, [`${storiesFile}.stories.${extension}`]);
  const entries = Object.values(index.entries);
  const stories = entries.filter((entry) => entry.type === 'story');
  const autodocs = entries.find((entry) => entry.type === 'docs');
  const sidebar = sidebarOf(index);

  return {
    autodocsCreated: !!autodocs,
    autodocsTags: tagsOf(autodocs),
    autodocsInSidebar: sidebar.has(autodocs),
    storyTags: Object.fromEntries(stories.map((story) => [story.name, tagsOf(story)])),
    sidebarEntries: sidebar.entries,
    sidebarComponentTags: sidebar.componentTags,
    storiesOnDocsPage: autodocs ? storiesShownByStoriesBlock(stories) : null,
  };
}

async function recordAttachedMdx(project: Project, storiesFile: string, mdxFile: string) {
  let index: StoryIndex;
  try {
    index = await indexFiles(project, [`${storiesFile}.stories.ts`, `${mdxFile}.mdx`]);
  } catch (error) {
    return { indexingError: String(error).split('Error: ')[1].split('. ')[0] };
  }
  const docsEntries = Object.values(index.entries).filter((entry) => entry.type === 'docs');
  const mdx = docsEntries.find(isAttachedMdx);
  const autodocs = docsEntries.find((entry) => !isAttachedMdx(entry));
  const sidebar = sidebarOf(index);

  return {
    mdxName: mdx?.name ?? null,
    mdxTags: tagsOf(mdx),
    mdxInSidebar: sidebar.has(mdx),
    mdxInManifest: mdx?.tags?.includes(Tag.MANIFEST) ?? false,
    autodocsTags: tagsOf(autodocs),
    sidebarEntries: sidebar.entries,
    sidebarComponentTags: sidebar.componentTags,
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
        "autodocsTags": "dev, test, manifest",
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
          "autodocsTags": "dev, test, manifest",
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

  it('L: meta removes manifest', async () => {
    expect(await recordAutodocs('default-project', 'L-meta-removes-manifest'))
      .toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, autodocs",
        "sidebarComponentTags": "dev, test, autodocs",
        "sidebarEntries": "Docs, Story 1, Story 2",
        "storiesOnDocsPage": "Story 1, Story 2",
        "storyTags": {
          "Story 1": "dev, test, autodocs",
          "Story 2": "dev, test, autodocs",
        },
      }
    `);
  });

  it('M: story with a test', async () => {
    expect(await recordAutodocs('default-project', 'M-story-with-test', 'js'))
      .toMatchInlineSnapshot(`
      {
        "autodocsCreated": true,
        "autodocsInSidebar": true,
        "autodocsTags": "dev, test, manifest, autodocs",
        "sidebarComponentTags": "dev, test, manifest",
        "sidebarEntries": "Docs, Story 1, renders",
        "storiesOnDocsPage": "Story 1",
        "storyTags": {
          "Story 1": "dev, test, manifest, autodocs",
          "renders": "dev, test, manifest, test-fn",
        },
      }
    `);
  });

  it('K: ignores the stories of a subcomponent', async () => {
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

describe('MDX docs page that takes the name of the autodocs entry', () => {
  it('A: autodocs only in meta', async () => {
    expect(await recordAttachedMdx('default-project', 'A-tag-only-in-meta', 'A-tag-only-in-meta'))
      .toMatchInlineSnapshot(`
      {
        "indexingError": "You created a component docs page for 'A-tag-only-in-meta', but also tagged the CSF file with 'autodocs'",
      }
    `);
  });

  it('B: autodocs in all stories', async () => {
    expect(
      await recordAttachedMdx('default-project', 'B-tag-in-all-stories', 'B-tag-in-all-stories')
    ).toMatchInlineSnapshot(`
      {
        "indexingError": "You created a component docs page for 'B-tag-in-all-stories', but also tagged the CSF file with 'autodocs'",
      }
    `);
  });

  it('C: autodocs in some stories', async () => {
    expect(
      await recordAttachedMdx('default-project', 'C-tag-in-some-stories', 'C-tag-in-some-stories')
    ).toMatchInlineSnapshot(`
      {
        "autodocsTags": null,
        "mdxInManifest": true,
        "mdxInSidebar": true,
        "mdxName": "Docs",
        "mdxTags": "dev, test, manifest, attached-mdx",
        "sidebarComponentTags": "dev, test, manifest",
        "sidebarEntries": "Docs, Story 1, Story 2",
      }
    `);
  });

  it('D: autodocs inherited from project', async () => {
    expect(
      await recordAttachedMdx(
        'autodocs-project',
        'D-tag-inherited-from-project',
        'D-tag-inherited-from-project'
      )
    ).toMatchInlineSnapshot(`
      {
        "autodocsTags": null,
        "mdxInManifest": true,
        "mdxInSidebar": true,
        "mdxName": "Docs",
        "mdxTags": "dev, test, manifest, autodocs, attached-mdx",
        "sidebarComponentTags": "dev, test, manifest, autodocs",
        "sidebarEntries": "Docs, Story 1, Story 2",
      }
    `);
  });

  it('E: first story excluded from autodocs', async () => {
    expect(
      await recordAttachedMdx('default-project', 'E-first-story-excluded', 'E-first-story-excluded')
    ).toMatchInlineSnapshot(`
      {
        "autodocsTags": null,
        "mdxInManifest": true,
        "mdxInSidebar": true,
        "mdxName": "Docs",
        "mdxTags": "dev, test, manifest, attached-mdx",
        "sidebarComponentTags": "dev, test, manifest",
        "sidebarEntries": "Docs, Story 1, Story 2",
      }
    `);
  });
});

describe('MDX docs page attached next to the autodocs entry', () => {
  it('H: first story removes dev and manifest', async () => {
    expect(await recordAttachedMdx('default-project', 'H-first-story-hidden', 'H-guide'))
      .toMatchInlineSnapshot(`
        {
          "autodocsTags": "test, autodocs",
          "mdxInManifest": true,
          "mdxInSidebar": true,
          "mdxName": "Guide",
          "mdxTags": "dev, test, manifest, autodocs, attached-mdx",
          "sidebarComponentTags": "test, autodocs",
          "sidebarEntries": "Docs, Story 2, Guide",
        }
      `);
  });

  it('I: last story removes dev and manifest', async () => {
    expect(await recordAttachedMdx('default-project', 'I-last-story-hidden', 'I-guide'))
      .toMatchInlineSnapshot(`
        {
          "autodocsTags": "test, autodocs",
          "mdxInManifest": true,
          "mdxInSidebar": true,
          "mdxName": "Guide",
          "mdxTags": "dev, test, manifest, autodocs, attached-mdx",
          "sidebarComponentTags": "test, autodocs",
          "sidebarEntries": "Docs, Story 1, Guide",
        }
      `);
  });

  it('J: meta removes dev to make a docs-only component', async () => {
    expect(await recordAttachedMdx('default-project', 'J-docs-only-component', 'J-guide'))
      .toMatchInlineSnapshot(`
        {
          "autodocsTags": "test, manifest, autodocs",
          "mdxInManifest": true,
          "mdxInSidebar": true,
          "mdxName": "Guide",
          "mdxTags": "dev, test, manifest, autodocs, attached-mdx",
          "sidebarComponentTags": "test, manifest, autodocs",
          "sidebarEntries": "Docs, Guide",
        }
      `);
  });

  it('L: meta removes manifest', async () => {
    expect(await recordAttachedMdx('default-project', 'L-meta-removes-manifest', 'L-guide'))
      .toMatchInlineSnapshot(`
        {
          "autodocsTags": "dev, test, autodocs",
          "mdxInManifest": true,
          "mdxInSidebar": true,
          "mdxName": "Guide",
          "mdxTags": "dev, test, manifest, autodocs, attached-mdx",
          "sidebarComponentTags": "dev, test, autodocs",
          "sidebarEntries": "Docs, Story 1, Story 2, Guide",
        }
      `);
  });
});
