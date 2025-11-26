// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { mockDataset } from '../components/sidebar/mockdata';
import { getGroupStatus, getMostCriticalStatusValue } from './status';

describe('getHighestStatus', () => {
  it('default value', () => {
    expect(getMostCriticalStatusValue([])).toBe('status-value:unknown');
  });
  it('should return the highest status', () => {
    expect(
      getMostCriticalStatusValue([
        'status-value:success',
        'status-value:error',
        'status-value:warning',
        'status-value:pending',
      ])
    ).toBe('status-value:error');
    expect(
      getMostCriticalStatusValue([
        'status-value:error',
        'status-value:error',
        'status-value:warning',
        'status-value:pending',
      ])
    ).toBe('status-value:error');
    expect(getMostCriticalStatusValue(['status-value:warning', 'status-value:pending'])).toBe(
      'status-value:warning'
    );
  });
});

describe('getGroupStatus', () => {
  it('empty case', () => {
    expect(getGroupStatus({}, {})).toEqual({});
  });
  it('should return a color', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': {
          a: {
            storyId: 'group-1--child-b1',
            typeId: 'a',
            value: 'status-value:warning',
            description: '',
            title: '',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "status-value:warning",
        "group-1--child-b1": "status-value:unknown",
        "group-1--child-b2": "status-value:unknown",
        "root-1-child-a1": "status-value:unknown",
        "root-1-child-a2": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-1": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-1:test1": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-2": "status-value:unknown",
        "root-3--child-a1": "status-value:unknown",
        "root-3-child-a2": "status-value:unknown",
        "root-3-child-a2--grandchild-a1-1": "status-value:unknown",
        "root-3-child-a2--grandchild-a1-2": "status-value:unknown",
      }
    `);
  });
  it('should return the highest status', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': {
          a: {
            storyId: 'group-1--child-b1',
            typeId: 'a',
            value: 'status-value:warning',
            description: '',
            title: '',
          },
          b: {
            storyId: 'group-1--child-b1',
            typeId: 'b',
            value: 'status-value:error',
            description: '',
            title: '',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "status-value:error",
        "group-1--child-b1": "status-value:unknown",
        "group-1--child-b2": "status-value:unknown",
        "root-1-child-a1": "status-value:unknown",
        "root-1-child-a2": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-1": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-1:test1": "status-value:unknown",
        "root-1-child-a2--grandchild-a1-2": "status-value:unknown",
        "root-3--child-a1": "status-value:unknown",
        "root-3-child-a2": "status-value:unknown",
        "root-3-child-a2--grandchild-a1-1": "status-value:unknown",
        "root-3-child-a2--grandchild-a1-2": "status-value:unknown",
      }
    `);
  });
});
