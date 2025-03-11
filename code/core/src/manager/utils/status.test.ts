// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { StatusValue } from 'storybook/internal/types';

import { mockDataset } from '../components/sidebar/mockdata';
import { getGroupStatus, getMostCriticalStatusValue } from './status';

describe('getHighestStatus', () => {
  it('default value', () => {
    expect(getMostCriticalStatusValue([])).toBe('unknown');
  });
  it('should return the highest status', () => {
    expect(getMostCriticalStatusValue(['success', 'error', 'warn', 'pending'])).toBe('error');
    expect(getMostCriticalStatusValue(['error', 'error', 'warn', 'pending'])).toBe('error');
    expect(getMostCriticalStatusValue(['warn', 'pending'])).toBe('warn');
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
            value: StatusValue.WARN,
            description: '',
            title: '',
          },
        },
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
          a: {
            storyId: 'group-1--child-b1',
            typeId: 'a',
            value: StatusValue.WARN,
            description: '',
            title: '',
          },
          b: {
            storyId: 'group-1--child-b1',
            typeId: 'b',
            value: StatusValue.ERROR,
            description: '',
            title: '',
          },
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
