import { describe, expect, it } from 'vitest';

import {
  type API_PreparedStoryIndex,
  type StatusesByStoryIdAndTypeId,
  type StoryIndexV2,
  type StoryIndexV3,
} from 'storybook/internal/types';

import type { State } from '../root.tsx';
import { mockEntries } from '../tests/mockStoriesEntries.ts';
import {
  transformStoryIndexToStoriesHash,
  transformStoryIndexV2toV3,
  transformStoryIndexV3toV4,
  transformStoryIndexV4toV5,
} from './stories.ts';

const baseV2: StoryIndexV2['stories'][0] = {
  id: '1',
  story: '',
  kind: '',
  parameters: {},
};

const baseV3: StoryIndexV3['stories'][0] = {
  id: '1',
  title: '',
  name: '',
  story: '',
  kind: '',
  parameters: {},
  importPath: '',
};

describe('transformStoryIndexV2toV3', () => {
  it('transforms a StoryIndexV2 to a StoryIndexV3 correctly', () => {
    const indexV2: StoryIndexV2 = {
      v: 2,
      stories: {
        '1': {
          ...baseV2,
          id: '1',
          kind: 'story',
          story: 'Story 1',
        },
        '2': {
          ...baseV2,
          id: '2',
          kind: 'blog',
          story: 'Blog 1',
        },
      },
    };

    expect(transformStoryIndexV2toV3(indexV2)).toMatchInlineSnapshot(`
      {
        "stories": {
          "1": {
            "id": "1",
            "importPath": "",
            "kind": "story",
            "name": "Story 1",
            "parameters": {},
            "story": "Story 1",
            "title": "story",
          },
          "2": {
            "id": "2",
            "importPath": "",
            "kind": "blog",
            "name": "Blog 1",
            "parameters": {},
            "story": "Blog 1",
            "title": "blog",
          },
        },
        "v": 3,
      }
    `);
  });
});

describe('transformStoryIndexV3toV4', () => {
  it('transforms a StoryIndexV3 to an API_PreparedStoryIndex correctly', () => {
    const indexV3: StoryIndexV3 = {
      v: 3,
      stories: {
        '1': {
          ...baseV3,
          id: '1',
          kind: 'story',
          title: 'Story 1',
          parameters: {
            docsOnly: true,
          },
        },
        '2': {
          ...baseV3,
          id: '2',
          kind: 'page',
          name: 'Page 1',
          title: 'Page 1',
        },
        '3': {
          ...baseV3,
          id: '3',
          kind: 'story',
          title: 'Story 2',
        },
        '4': {
          ...baseV3,
          id: '4',
          kind: 'page',
          name: 'Page 2',
          title: 'Page 1',
        },
      },
    };

    expect(transformStoryIndexV3toV4(indexV3)).toMatchInlineSnapshot(`
      {
        "entries": {
          "1": {
            "id": "1",
            "importPath": "",
            "name": "",
            "parameters": {
              "docsOnly": true,
            },
            "storiesImports": [],
            "tags": [
              "stories-mdx",
            ],
            "title": "Story 1",
            "type": "docs",
          },
          "2": {
            "id": "2",
            "importPath": "",
            "name": "Page 1",
            "parameters": {},
            "title": "Page 1",
            "type": "story",
          },
          "3": {
            "id": "3",
            "importPath": "",
            "name": "",
            "parameters": {},
            "title": "Story 2",
            "type": "story",
          },
          "4": {
            "id": "4",
            "importPath": "",
            "name": "Page 2",
            "parameters": {},
            "title": "Page 1",
            "type": "story",
          },
        },
        "v": 4,
      }
    `);
  });
});

describe('transformStoryIndexV4toV5', () => {
  it('transforms a StoryIndexV4 to an API_PreparedStoryIndex correctly', () => {
    const indexV4: API_PreparedStoryIndex = {
      v: 4,
      entries: mockEntries,
    };

    expect(transformStoryIndexV4toV5(indexV4)).toMatchInlineSnapshot(`
      {
        "entries": {
          "component-a--docs": {
            "id": "component-a--docs",
            "importPath": "./path/to/component-a.ts",
            "name": "Docs",
            "storiesImports": [],
            "tags": [
              "dev",
            ],
            "title": "Component A",
            "type": "docs",
          },
          "component-a--story-1": {
            "id": "component-a--story-1",
            "importPath": "./path/to/component-a.ts",
            "name": "Story 1",
            "subtype": "story",
            "tags": [
              "dev",
            ],
            "title": "Component A",
            "type": "story",
          },
          "component-a--story-2": {
            "id": "component-a--story-2",
            "importPath": "./path/to/component-a.ts",
            "name": "Story 2",
            "subtype": "story",
            "tags": [
              "dev",
            ],
            "title": "Component A",
            "type": "story",
          },
          "component-b--story-3": {
            "id": "component-b--story-3",
            "importPath": "./path/to/component-b.ts",
            "name": "Story 3",
            "subtype": "story",
            "tags": [
              "dev",
            ],
            "title": "Component B",
            "type": "story",
          },
        },
        "v": 5,
      }
    `);
  });
});

describe('transformStoryIndexToStoriesHash', () => {
  it('does not apply filters to failing stories', () => {
    // Arrange - set up an index with two stories, one of which has a failing status
    const indexV5: API_PreparedStoryIndex = {
      v: 5,
      entries: {
        '1': {
          id: '1',
          type: 'story',
          subtype: 'story',
          title: 'Story 1',
          name: 'Story 1',
          importPath: './path/to/story-1.ts',
          parameters: {},
          tags: [],
        },
        '2': {
          id: '2',
          type: 'story',
          subtype: 'story',
          title: 'Story 2',
          name: 'Story 2',
          importPath: './path/to/story-2.ts',
          parameters: {},
          tags: [],
        },
      },
    };

    const filters: State['filters'] = {
      someFilter: () => false,
    };

    const allStatuses: StatusesByStoryIdAndTypeId = {
      '1': {
        someStatus: {
          typeId: 'someStatus',
          storyId: '1',
          value: 'status-value:error',
          title: 'broken',
          description: 'very bad',
        },
      },
      '2': {
        someStatus: {
          typeId: 'someStatus',
          storyId: '2',
          value: 'status-value:success',
          title: 'perfect',
          description: 'nice',
        },
      },
    };

    const options = {
      provider: {
        getConfig: () => ({ sidebar: {} }),
      } as any,
      docsOptions: { docsMode: false },
      filters,
      allStatuses,
    };

    // Act - transform the index to hashes
    const result = transformStoryIndexToStoriesHash(indexV5, options);

    // Assert - the failing story is still present in the result, even though the filters remove all stories
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['story-1']).toBeTruthy();
    expect(result['1']).toBeTruthy();
    expect(result['story-2']).toBeUndefined();
    expect(result['2']).toBeUndefined();
  });

  describe('title types', () => {
    const options = {
      provider: { getConfig: () => ({ sidebar: {} }) } as any,
      docsOptions: { docsMode: false },
      filters: {},
      allStatuses: {},
    };
    const docs = (id: string, title: string, name = 'Docs') => ({
      id,
      type: 'docs' as const,
      title,
      name,
      importPath: `./${id}.mdx`,
      storiesImports: [],
      tags: [],
    });
    const index: API_PreparedStoryIndex = {
      v: 5,
      entries: {
        'welcome--docs': docs('welcome--docs', 'Welcome'),
        'guides-intro--docs': docs('guides-intro--docs', 'Guides/Intro'),
        'guides-faq--setup': docs('guides-faq--setup', 'Guides/FAQ', 'Setup'),
        'guides-faq--usage': docs('guides-faq--usage', 'Guides/FAQ', 'Usage'),
        'guides-button--docs': docs('guides-button--docs', 'Guides/Button'),
        'guides-button--primary': {
          id: 'guides-button--primary',
          type: 'story',
          subtype: 'story',
          title: 'Guides/Button',
          name: 'Primary',
          importPath: './button.stories.ts',
          tags: [],
        },
      },
    };
    const result = transformStoryIndexToStoriesHash(index, options);

    it('puts a single unattached docs page in place of its title', () => {
      expect(result['guides-intro']).toBeUndefined();
      expect(result['guides-intro--docs']).toMatchObject({
        name: 'Intro',
        parent: 'guides',
        depth: 1,
      });
      expect(result['guides']).toMatchObject({
        children: ['guides-intro--docs', 'guides-faq', 'guides-button'],
      });
    });

    it('puts a root-level unattached docs page at the root', () => {
      expect(result['welcome']).toBeUndefined();
      expect(result['welcome--docs']).toMatchObject({
        name: 'Welcome',
        parent: undefined,
        depth: 0,
      });
    });

    it('makes a title with several docs pages and no stories a group', () => {
      expect(result['guides-faq']).toMatchObject({
        type: 'group',
        children: ['guides-faq--setup', 'guides-faq--usage'],
      });
      expect(result['guides-faq--setup']).toMatchObject({ name: 'Setup', parent: 'guides-faq' });
    });

    it('keeps the component of a docs page that has stories', () => {
      expect(result['guides-button']).toMatchObject({
        type: 'component',
        children: ['guides-button--docs', 'guides-button--primary'],
      });
      expect(result['guides-button--docs']).toMatchObject({
        name: 'Docs',
        parent: 'guides-button',
      });
    });

    it('keeps the component when filters hide all of its stories', () => {
      const filtered = transformStoryIndexToStoriesHash(index, {
        ...options,
        filters: { hideStories: (entry) => entry.type !== 'story' },
      });
      expect(filtered['guides-button']).toMatchObject({
        type: 'component',
        children: ['guides-button--docs'],
      });
      expect(filtered['guides-button--primary']).toBeUndefined();
    });
  });
});
