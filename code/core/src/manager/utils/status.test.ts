// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { mockDataset } from '../components/sidebar/mockdata';
import { getGroupStatus, getHighestStatus } from './status';

describe('getHighestStatus', () => {
  it('default value', () => {
    expect(getHighestStatus([])).toBe('unknown');
  });
  it('should return the highest status', () => {
    expect(getHighestStatus(['success', 'error', 'warn', 'pending'])).toBe('error');
    expect(getHighestStatus(['error', 'error', 'warn', 'pending'])).toBe('error');
    expect(getHighestStatus(['warn', 'pending'])).toBe('warn');
  });
});

describe('getGroupStatus', () => {
  it('empty case', () => {
    expect(getGroupStatus({}, {})).toEqual({});
  });
  it('should return a color', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': { a: { status: 'warn', description: '', title: '' } },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "warn",
        "root-1-child-a1": "unknown",
        "root-1-child-a2": "unknown",
        "root-3-child-a2": "unknown",
      }
    `);
  });
  it('should return the highest status', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': {
          a: { status: 'warn', description: '', title: '' },
          b: { status: 'error', description: '', title: '' },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "error",
        "root-1-child-a1": "unknown",
        "root-1-child-a2": "unknown",
        "root-3-child-a2": "unknown",
      }
    `);
  });
});
