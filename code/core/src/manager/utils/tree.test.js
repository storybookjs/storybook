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
