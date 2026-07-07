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

describe('createId', () => {
  it('creates an id', () => {
    const inputs = ['testpath', 'testref'];
    const output = utils.createId(...inputs);

    expect(output).toEqual('testref_testpath');
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

describe('collapseSingleStoryComponents', () => {
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
    const collapsed = utils.collapseSingleStoryComponents(makeData());

    // The component entry is gone — no phantom row can render from its parent pointer.
    expect(collapsed.button).toBeUndefined();
    // The story took the component's place: name, parent and depth.
    expect(collapsed['button--only']).toMatchObject({
      name: 'Button',
      parent: 'root',
      depth: 1,
    });
    // The grandparent's children now point at the story.
    expect(collapsed.root.children).toEqual(['button--only', 'card']);
  });

  it('leaves multi-story components untouched', () => {
    const collapsed = utils.collapseSingleStoryComponents(makeData());
    expect(collapsed.card).toBeDefined();
    expect(collapsed['card--a'].parent).toBe('card');
  });

  it('hoisted stories do not leave phantom rows in indexToTree', () => {
    const collapsed = utils.collapseSingleStoryComponents(makeData());
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
    const collapsed = utils.collapseSingleStoryComponents(data);
    expect(collapsed.intro).toBeUndefined();
    expect(collapsed['intro--docs']).toMatchObject({ name: 'Intro', depth: 0 });
    expect(collapsed['intro--docs'].parent).toBeUndefined();
  });
});
