// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { StatusByTypeId, StatusValue } from 'storybook/internal/types';

import { mockDataset } from '../components/sidebar/mockdata.ts';
import { getChangeDetectionStatus, getGroupStatus, getMostCriticalStatusValue } from './status.tsx';

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
  it('should rank new and modified between success and warning', () => {
    expect(
      getMostCriticalStatusValue([
        'status-value:new',
        'status-value:modified',
        'status-value:success',
      ])
    ).toBe('status-value:new');
  });
  it('should rank warning above new', () => {
    expect(getMostCriticalStatusValue(['status-value:new', 'status-value:warning'])).toBe(
      'status-value:warning'
    );
  });

  it('should rank affected below modified and below warning', () => {
    expect(
      getMostCriticalStatusValue([
        'status-value:affected',
        'status-value:modified',
        'status-value:success',
      ])
    ).toBe('status-value:modified');

    expect(getMostCriticalStatusValue(['status-value:modified', 'status-value:warning'])).toBe(
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
  it('should propagate status-value:new through group aggregation', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': {
          a: {
            storyId: 'group-1--child-b1',
            typeId: 'a',
            value: 'status-value:new',
            description: '',
            title: '',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "status-value:new",
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
  it('should propagate status-value:affected through group aggregation', () => {
    expect(
      getGroupStatus(mockDataset.withRoot, {
        'group-1--child-b1': {
          a: {
            storyId: 'group-1--child-b1',
            typeId: 'a',
            value: 'status-value:affected',
            description: '',
            title: '',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "group-1": "status-value:affected",
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

describe('dual-slot status splitting', () => {
  const makeStatus = (typeId: string, value: StatusValue) => ({
    storyId: 'story-1',
    typeId,
    value,
    title: '',
    description: '',
  });

  it('leaf with only change-detection status', () => {
    const statuses = {
      'storybook/change-detection': makeStatus('storybook/change-detection', 'status-value:new'),
    };
    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses);
    expect(changeStatus).toBe('status-value:new');
    expect(testStatus).toBe('status-value:unknown');
  });

  it('leaf with both change-detection and test status', () => {
    const statuses = {
      'storybook/change-detection': makeStatus(
        'storybook/change-detection',
        'status-value:modified'
      ),
      'storybook/vitest': makeStatus('storybook/vitest', 'status-value:error'),
    };
    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses);
    expect(changeStatus).toBe('status-value:modified');
    expect(testStatus).toBe('status-value:error');
  });

  it('leaf with only test status', () => {
    const statuses = {
      'storybook/vitest': makeStatus('storybook/vitest', 'status-value:warning'),
    };
    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses);
    expect(changeStatus).toBe('status-value:unknown');
    expect(testStatus).toBe('status-value:warning');
  });

  it('priority within change-detection slot: new beats modified beats affected', () => {
    const statuses = {
      first: makeStatus('storybook/change-detection', 'status-value:affected'),
      second: makeStatus('storybook/change-detection', 'status-value:modified'),
      third: makeStatus('storybook/change-detection', 'status-value:new'),
    } as unknown as StatusByTypeId;

    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses);
    expect(changeStatus).toBe('status-value:new');
    expect(testStatus).toBe('status-value:unknown');
  });

  it('branch/group combined priority: error beats new', () => {
    expect(getMostCriticalStatusValue(['status-value:new', 'status-value:error'])).toBe(
      'status-value:error'
    );
  });
});
