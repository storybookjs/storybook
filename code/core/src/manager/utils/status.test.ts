// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CHANGE_DETECTION_STATUS_TYPE_ID, REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { StatusByTypeId, StatusValue } from 'storybook/internal/types';

import { mockDataset } from '../components/sidebar/mockdata.ts';
import {
  getChangeDetectionStatus,
  getGroupStatus,
  getMostCriticalStatusValue,
  getStatusesWithVisibility,
} from './status.tsx';

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

  it('ignores reviewing status for sidebar test slot', () => {
    const statuses = {
      [REVIEW_STATUS_TYPE_ID]: makeStatus(REVIEW_STATUS_TYPE_ID, 'status-value:reviewing'),
      'storybook/vitest': makeStatus('storybook/vitest', 'status-value:success'),
    };
    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses);
    expect(changeStatus).toBe('status-value:unknown');
    expect(testStatus).toBe('status-value:success');
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

describe('getStatusesWithVisibility', () => {
  const storyId = 'group-1--child-b1';
  const testId = 'root-1-child-a2--grandchild-a1-1:test1';
  const makeStatus = (id: string, typeId: string, value: StatusValue) => ({
    storyId: id,
    typeId,
    value,
    title: '',
    description: '',
  });
  const annotate = (allStatuses: Parameters<typeof getStatusesWithVisibility>[0], filter = false) =>
    getStatusesWithVisibility(allStatuses, mockDataset.withRoot, filter);

  it('always shows "new" and never shows "affected" or "unknown" change-detection statuses', () => {
    const allStatuses = {
      [storyId]: {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: makeStatus(
          storyId,
          CHANGE_DETECTION_STATUS_TYPE_ID,
          'status-value:new'
        ),
      },
      'group-1--child-b2': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: makeStatus(
          'group-1--child-b2',
          CHANGE_DETECTION_STATUS_TYPE_ID,
          'status-value:affected'
        ),
      },
    };
    const result = annotate(allStatuses);
    expect(result[storyId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(true);
    expect(result['group-1--child-b2'][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(false);

    const withFilter = annotate(allStatuses, true);
    expect(withFilter[storyId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(true);
    expect(withFilter['group-1--child-b2'][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(false);
  });

  it('only shows "modified" while the modified filter is active', () => {
    const allStatuses = {
      [storyId]: {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: makeStatus(
          storyId,
          CHANGE_DETECTION_STATUS_TYPE_ID,
          'status-value:modified'
        ),
      },
    };
    expect(annotate(allStatuses)[storyId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(false);
    expect(annotate(allStatuses, true)[storyId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(
      true
    );
  });

  it('only keeps "new" change-detection statuses on test entries', () => {
    const allStatuses = {
      [testId]: {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: makeStatus(
          testId,
          CHANGE_DETECTION_STATUS_TYPE_ID,
          'status-value:modified'
        ),
      },
    };
    expect(annotate(allStatuses, true)[testId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(
      false
    );

    const newStatus = {
      [testId]: {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: makeStatus(
          testId,
          CHANGE_DETECTION_STATUS_TYPE_ID,
          'status-value:new'
        ),
      },
    };
    expect(annotate(newStatus)[testId][CHANGE_DETECTION_STATUS_TYPE_ID].visible).toBe(true);
  });

  it('hides review statuses on story rows but keeps them on test rows', () => {
    const allStatuses = {
      [storyId]: {
        [REVIEW_STATUS_TYPE_ID]: makeStatus(
          storyId,
          REVIEW_STATUS_TYPE_ID,
          'status-value:reviewing'
        ),
      },
      [testId]: {
        [REVIEW_STATUS_TYPE_ID]: makeStatus(
          testId,
          REVIEW_STATUS_TYPE_ID,
          'status-value:reviewing'
        ),
      },
    };
    const result = annotate(allStatuses);
    expect(result[storyId][REVIEW_STATUS_TYPE_ID].visible).toBe(false);
    expect(result[testId][REVIEW_STATUS_TYPE_ID].visible).toBe(true);
  });

  it('shows test statuses with a known value and hides unknown ones', () => {
    const allStatuses = {
      [storyId]: {
        'storybook/vitest': makeStatus(storyId, 'storybook/vitest', 'status-value:error'),
        'storybook/other': makeStatus(storyId, 'storybook/other', 'status-value:unknown'),
      },
    };
    const result = annotate(allStatuses);
    expect(result[storyId]['storybook/vitest'].visible).toBe(true);
    expect(result[storyId]['storybook/other'].visible).toBe(false);
  });
});
