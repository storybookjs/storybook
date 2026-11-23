// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { mockDataset, mockExpanded, mockSelected } from '../components/sidebar/mockdata';
import * as utils from './tree';

const noRoot = {
  dataset: mockDataset.noRoot,
  selected: mockSelected.noRoot,
  expanded: mockExpanded.noRoot,
};

describe('sanity', () => {
  it('all exports should be functions', () => {
    Object.values(utils).forEach((i) => {
      expect(typeof i).toBe('function');
    });
  });
});

describe('get', () => {
  it('retrieved by key', () => {
    const value = {};
    const inputs = ['testkey', { testkey: value, x: 'incorrect' }];
    const output = utils.get(inputs[0], inputs[1]);

    expect(output).toBe(value);
  });
  it('retrieve non-existent returns undefined', () => {
    const value = {};
    const inputs = ['NONEXISTENT', { testkey: value, x: 'incorrect' }];
    const output = utils.get(inputs[0], inputs[1]);

    expect(output).toBe(undefined);
  });
});

describe('getParent', () => {
  it('retrieved by id (level 0) returns undefined', () => {
    const output = utils.getParent('group-1', noRoot.dataset);
    expect(output).toBe(undefined);
  });
  it('retrieved by id (level 1) returns correctly', () => {
    const output = utils.getParent('group-1--child-b1', noRoot.dataset);
    expect(output).toBe(noRoot.dataset['group-1']);
  });
  it('retrieved by id (level 2) returns correctly', () => {
    const output = utils.getParent('root-1-child-a2--grandchild-a1-1', noRoot.dataset);
    expect(output).toBe(noRoot.dataset['root-1-child-a2']);
  });
  it('retrieve non-existent returns undefined', () => {
    const output = utils.getParent('NONEXISTENT', noRoot.dataset);
    expect(output).toBe(undefined);
  });
});

describe('getParents', () => {
  it('retrieved by id (level 0) returns correctly', () => {
    const output = utils.getParents('group-1', noRoot.dataset);
    expect(output).toEqual([]);
  });
  it('retrieved by id (level 1) returns correctly', () => {
    const output = utils.getParents('group-1--child-b1', noRoot.dataset);
    expect(output).toEqual([noRoot.dataset['group-1']]);
  });
  it('retrieved by id (level 2) returns correctly', () => {
    const output = utils.getParents('root-1-child-a2--grandchild-a1-1', noRoot.dataset);
    expect(output).toEqual([noRoot.dataset['root-1-child-a2'], noRoot.dataset['root-1']]);
  });
  it('retrieve non-existent returns empty array', () => {
    const output = utils.getParents('NONEXISTENT', noRoot.dataset);
    expect(output).toEqual([]);
  });
});

describe('isStoryHoistable', () => {
  it('return true for matching Story and Component name', () => {
    const output = utils.isStoryHoistable('Very_Long-Button Story Name', 'VeryLongButtonStoryName');
    expect(output).toEqual(true);
  });

  it('return false for non-matching names', () => {
    const output = utils.isStoryHoistable('Butto Story', 'ButtonStory');
    expect(output).toEqual(false);
  });
});

describe('hoistSingleStoryComponents', () => {
  const makeData = () => ({
    root: { type: 'root', id: 'root', name: 'Root', depth: 0, children: ['button', 'card'] },
    button: {
      type: 'component',
      id: 'button',
      name: 'Button',
      depth: 1,
      parent: 'root',
      children: ['button--only'],
    },
    'button--only': {
      type: 'story',
      subtype: 'story',
      id: 'button--only',
      name: 'Button',
      title: 'Button',
      depth: 2,
      parent: 'button',
      prepared: true,
      importPath: './x.ts',
      tags: [],
      children: [],
    },
    card: {
      type: 'component',
      id: 'card',
      name: 'Card',
      depth: 1,
      parent: 'root',
      children: ['card--a', 'card--b'],
    },
    'card--a': {
      type: 'story',
      subtype: 'story',
      id: 'card--a',
      name: 'A',
      title: 'Card',
      depth: 2,
      parent: 'card',
      prepared: true,
      importPath: './x.ts',
      tags: [],
      children: [],
    },
    'card--b': {
      type: 'story',
      subtype: 'story',
      id: 'card--b',
      name: 'B',
      title: 'Card',
      depth: 2,
      parent: 'card',
      prepared: true,
      importPath: './x.ts',
      tags: [],
      children: [],
    },
  });

  it('replaces a single-story component with its hoisted story', () => {
    const collapsed = utils.hoistSingleStoryComponents(makeData());

    // The component entry is removed, so no row can render from its parent pointer.
    expect(collapsed.button).toBeUndefined();
    // The story takes the name, parent and depth of the component.
    expect(collapsed['button--only']).toMatchObject({
      name: 'Button',
      parent: 'root',
      depth: 1,
    });
    // The children of the grandparent point at the story.
    expect(collapsed.root.children).toEqual(['button--only', 'card']);
  });

  it('leaves multi-story components untouched', () => {
    const collapsed = utils.hoistSingleStoryComponents(makeData());
    expect(collapsed.card).toBeDefined();
    expect(collapsed['card--a'].parent).toBe('card');
  });

  it('hoisted stories do not leave phantom rows in indexToTree', () => {
    const collapsed = utils.hoistSingleStoryComponents(makeData());
    const tree = utils.indexToTree(collapsed);
    const flat = [];
    const walk = (nodes) =>
      nodes.forEach((node) => {
        flat.push(node.id);
        if (node.resolvedChildren) {
          walk(node.resolvedChildren);
        }
      });
    walk(tree);
    expect(flat.filter((id) => id.startsWith('button')).length).toBe(1);
  });

  it('hoists docs-only components', () => {
    const data = {
      intro: {
        type: 'component',
        id: 'intro',
        name: 'Intro',
        depth: 0,
        children: ['intro--docs'],
      },
      'intro--docs': {
        type: 'docs',
        id: 'intro--docs',
        name: 'Docs',
        title: 'Intro',
        depth: 1,
        parent: 'intro',
        prepared: true,
        importPath: './x.mdx',
        tags: [],
      },
    };
    const collapsed = utils.hoistSingleStoryComponents(data);
    expect(collapsed.intro).toBeUndefined();
    expect(collapsed['intro--docs']).toMatchObject({ name: 'Intro', depth: 0 });
    expect(collapsed['intro--docs'].parent).toBeUndefined();
  });
});

describe('hoistSingleStoryComponents with sibling hoists', () => {
  it('hoists two single-story components sharing a parent without losing either', () => {
    const data = {
      root: { type: 'root', id: 'root', name: 'Root', depth: 0, children: ['a', 'b'] },
      a: { type: 'component', id: 'a', name: 'A', depth: 1, parent: 'root', children: ['a--a'] },
      'a--a': {
        type: 'story',
        subtype: 'story',
        id: 'a--a',
        name: 'A',
        title: 'A',
        depth: 2,
        parent: 'a',
        prepared: true,
        importPath: './x.ts',
        tags: [],
        children: [],
      },
      b: { type: 'component', id: 'b', name: 'B', depth: 1, parent: 'root', children: ['b--b'] },
      'b--b': {
        type: 'story',
        subtype: 'story',
        id: 'b--b',
        name: 'B',
        title: 'B',
        depth: 2,
        parent: 'b',
        prepared: true,
        importPath: './x.ts',
        tags: [],
        children: [],
      },
    };
    const collapsed = utils.hoistSingleStoryComponents(data);
    expect(collapsed.root.children).toEqual(['a--a', 'b--b']);
    expect(collapsed.a).toBeUndefined();
    expect(collapsed.b).toBeUndefined();
    expect(collapsed['a--a'].parent).toBe('root');
    expect(collapsed['b--b'].parent).toBe('root');
  });
});

describe('recentlyOpenedItem', () => {
  const leaf = (type, id, name, parent, extra = {}) => ({
    type,
    ...(type === 'story' && { subtype: 'story' }),
    id,
    name,
    title: '',
    depth: 0,
    parent,
    prepared: true,
    importPath: './x.ts',
    tags: [],
    ...extra,
  });
  const index = {
    example: { type: 'root', id: 'example', name: 'Example', depth: 0, children: [] },
    'example-forms': {
      type: 'group',
      id: 'example-forms',
      name: 'Forms',
      depth: 1,
      parent: 'example',
      children: ['example-forms-button'],
    },
    'example-forms-button': {
      type: 'component',
      id: 'example-forms-button',
      name: 'Button',
      depth: 2,
      parent: 'example-forms',
      children: [
        'example-forms-button--docs',
        'example-forms-button--primary',
        'example-forms-button--secondary',
      ],
    },
    'example-forms-button--docs': leaf(
      'docs',
      'example-forms-button--docs',
      'Docs',
      'example-forms-button',
      {
        anchors: [
          { id: 'anchor--primary', title: 'Primary' },
          { id: 'anchor--example', title: 'Example' },
        ],
      }
    ),
    'example-forms-button--primary': leaf(
      'story',
      'example-forms-button--primary',
      'Primary',
      'example-forms-button',
      { children: ['example-forms-button--primary:renders'] }
    ),
    'example-forms-button--primary:renders': leaf(
      'story',
      'example-forms-button--primary:renders',
      'renders',
      'example-forms-button--primary',
      { subtype: 'test' }
    ),
    'example-forms-button--secondary': leaf(
      'story',
      'example-forms-button--secondary',
      'Secondary',
      'example-forms-button'
    ),
    'example-header': {
      type: 'component',
      id: 'example-header',
      name: 'Header',
      depth: 1,
      parent: 'example',
      children: ['example-header--header'],
    },
    'example-header--header': leaf('story', 'example-header--header', 'Header', 'example-header'),
    'example-introduction--docs': leaf(
      'docs',
      'example-introduction--docs',
      'Introduction',
      'example'
    ),
    guides: { type: 'group', id: 'guides', name: 'Guides', depth: 0, children: [] },
    'guides-theming--docs': leaf('docs', 'guides-theming--docs', 'Theming', 'guides'),
    card: { type: 'group', id: 'card', name: 'Card', depth: 0, children: ['card--default'] },
    'card--default': leaf('story', 'card--default', 'Default', 'card'),
  };
  const ref = { id: 'storybook_internal', index };
  const itemFor = (storyId, from = ref, anchor) =>
    utils.recentlyOpenedItem({ storyId, refId: from.id, anchor }, from);

  it('names a story after its component, then the story', () => {
    expect(itemFor('example-forms-button--primary')).toMatchObject({
      id: 'example-forms-button--primary',
      type: 'story',
      refId: 'storybook_internal',
      name: 'Button / Primary',
      path: ['Example', 'Forms'],
    });
  });

  it('names a docs page after its component, then the docs page', () => {
    expect(itemFor('example-forms-button--docs')).toMatchObject({
      name: 'Button / Docs',
      path: ['Example', 'Forms'],
    });
  });

  it('names a test after its component and its story', () => {
    expect(itemFor('example-forms-button--primary:renders')).toMatchObject({
      name: 'Button / Primary / renders',
      path: ['Example', 'Forms'],
    });
  });

  it('names a story the tree hoists into its component after the component only', () => {
    expect(itemFor('example-header--header')).toMatchObject({
      name: 'Header',
      path: ['Example'],
    });
  });

  it('names a story of a group that also nests components after the group', () => {
    expect(itemFor('card--default')).toMatchObject({ name: 'Card / Default', path: [] });
  });

  it('names an unattached docs page after its folder, never after a root', () => {
    expect(itemFor('guides-theming--docs')).toMatchObject({ name: 'Guides / Theming', path: [] });
    expect(itemFor('example-introduction--docs')).toMatchObject({
      name: 'Introduction',
      path: ['Example'],
    });
  });

  it('names a docs heading after its docs page, then the heading', () => {
    expect(itemFor('example-forms-button--docs', ref, 'anchor--primary')).toMatchObject({
      id: 'example-forms-button--docs#anchor--primary',
      name: 'Button / Docs / Primary',
      path: ['Example', 'Forms'],
    });
  });

  it('leaves out a heading named like the first group of its docs page', () => {
    expect(itemFor('example-forms-button--docs', ref, 'anchor--example')).toMatchObject({
      id: 'example-forms-button--docs#anchor--example',
      name: 'Button / Docs',
    });
  });

  it('opens the docs page itself when its heading no longer exists', () => {
    expect(itemFor('example-forms-button--docs', ref, 'anchor--removed')).toMatchObject({
      id: 'example-forms-button--docs',
      name: 'Button / Docs',
    });
  });

  it('ignores an anchor on a story', () => {
    expect(itemFor('example-forms-button--primary', ref, 'anchor--primary')).toMatchObject({
      id: 'example-forms-button--primary',
      name: 'Button / Primary',
    });
  });

  it('skips entries that are missing or are not a story or docs page', () => {
    expect(itemFor('example-forms-button--removed')).toBeUndefined();
    expect(itemFor('example-forms-button')).toBeUndefined();
    expect(itemFor('example-forms')).toBeUndefined();
    expect(itemFor('example-forms-button--primary', { id: 'design-system' })).toBeUndefined();
  });

  it('starts the path of a composed Storybook entry with the Storybook title', () => {
    const composed = { id: 'design-system', title: 'Design System', index };
    expect(itemFor('example-forms-button--secondary', composed)).toMatchObject({
      refId: 'design-system',
      name: 'Button / Secondary',
      path: ['Design System', 'Example', 'Forms'],
    });
  });
});
