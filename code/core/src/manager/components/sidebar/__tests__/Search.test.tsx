// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';

import type { StoriesHash } from 'storybook/manager-api';

import { searchItem } from '../../../utils/tree.ts';
import type { CombinedDataset, SearchItem } from '../types.ts';

function makeDataset(stories: StoriesHash): CombinedDataset {
  const refId = 'storybook_internal';
  const ref = {
    index: stories,
    title: 'Storybook',
    id: refId,
    url: 'iframe.html',
    ready: true,
    error: false,
    allStatuses: {},
  };
  const hash = { [refId]: ref };
  return { hash, entries: Object.entries(hash) };
}

function makeSearchItems(stories: StoriesHash): SearchItem[] {
  const dataset = makeDataset(stories);
  const ref = dataset.hash.storybook_internal;
  return Object.values(stories).map((item) => searchItem(item, ref));
}

describe('Search - docs stories prefer docs entry over parent component', () => {
  test('when both component and docs entry match, docs entry is preferred', () => {
    const stories: StoriesHash = {
      'configure-your-project': {
        type: 'component',
        id: 'configure-your-project',
        name: 'Configure your project',
        children: ['configure-your-project--docs'],
        depth: 0,
        tags: [],
      },
      'configure-your-project--docs': {
        type: 'docs',
        id: 'configure-your-project--docs',
        name: 'Docs',
        parent: 'configure-your-project',
        title: 'Configure your project',
        depth: 1,
        tags: [],
      },
    };

    const searchItems = makeSearchItems(stories);

    const componentItem = searchItems.find((i) => i.type === 'component');
    const docsItem = searchItems.find((i) => i.type === 'docs');

    expect(componentItem).toBeDefined();
    expect(docsItem).toBeDefined();
    expect(componentItem!.name).toBe('Configure your project');
    expect(docsItem!.name).toBe('Docs');
    expect(docsItem!.parent).toBe('configure-your-project');
  });

  test('component with only docs children should be deprioritized', () => {
    const stories: StoriesHash = {
      'my-component': {
        type: 'component',
        id: 'my-component',
        name: 'My Component',
        children: ['my-component--docs'],
        depth: 0,
        tags: [],
      },
      'my-component--docs': {
        type: 'docs',
        id: 'my-component--docs',
        name: 'Docs',
        parent: 'my-component',
        title: 'My Component',
        depth: 1,
        tags: [],
      },
    };

    const searchItems = makeSearchItems(stories);

    // All items should be present
    expect(searchItems).toHaveLength(2);

    // Both types should exist
    const types = searchItems.map((i) => i.type);
    expect(types).toContain('component');
    expect(types).toContain('docs');
  });

  test('component with mixed children (docs + story) retains both types', () => {
    const stories: StoriesHash = {
      'button': {
        type: 'component',
        id: 'button',
        name: 'Button',
        children: ['button--docs', 'button--primary'],
        depth: 0,
        tags: [],
      },
      'button--docs': {
        type: 'docs',
        id: 'button--docs',
        name: 'Docs',
        parent: 'button',
        title: 'Button',
        depth: 1,
        tags: [],
      },
      'button--primary': {
        type: 'story',
        subtype: 'story',
        id: 'button--primary',
        name: 'Primary',
        parent: 'button',
        title: 'Button',
        depth: 1,
        tags: [],
        args: {},
        initialArgs: {},
        importPath: './button.stories.ts',
        prepared: true,
      },
    };

    const searchItems = makeSearchItems(stories);

    // All items should be present
    expect(searchItems).toHaveLength(3);

    const types = searchItems.map((i) => i.type);
    expect(types).toContain('component');
    expect(types).toContain('docs');
    expect(types).toContain('story');
  });
});
