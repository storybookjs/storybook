// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { StatusByTypeId, StatusValue } from 'storybook/internal/types';

import { mockDataset } from '../components/sidebar/mockdata.ts';
import {
  getChangeDetectionStatus,
  getGroupDualStatus,
  getGroupStatus,
  getMostCriticalStatusValue,
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

describe('getGroupDualStatus', () => {
  const makeStatus = (storyId: string, typeId: string, value: StatusValue) => ({
    storyId,
    typeId,
    value,
    title: '',
    description: '',
  });

  const data: any = {
    root: { type: 'root', id: 'root', name: 'Root', depth: 0, children: ['group'] },
    group: { type: 'group', id: 'group', name: 'G', depth: 1, parent: 'root', children: ['comp'] },
    comp: {
      type: 'component',
      id: 'comp',
      name: 'C',
      depth: 2,
      parent: 'group',
      children: ['comp--a'],
    },
    'comp--a': {
      type: 'story',
      subtype: 'story',
      id: 'comp--a',
      name: 'A',
      title: 'C',
      depth: 3,
      parent: 'comp',
      prepared: true,
      importPath: './x.ts',
      tags: [],
      children: [],
    },
  };

  it("includes a leaf story's own statuses on its own row", () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': { vitest: makeStatus('comp--a', 'vitest', 'status-value:error') },
    });
    expect(dual['comp--a'].test.value).toBe('status-value:error');
    expect(dual['comp--a'].change.value).toBe('status-value:unknown');
  });

  it('rolls statuses up the ancestor chain but never onto roots', () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': {
        vitest: makeStatus('comp--a', 'vitest', 'status-value:warning'),
        'storybook/change-detection': makeStatus(
          'comp--a',
          'storybook/change-detection',
          'status-value:new'
        ),
      },
    });
    for (const id of ['comp--a', 'comp', 'group']) {
      expect(dual[id].test.value).toBe('status-value:warning');
      expect(dual[id].change.value).toBe('status-value:new');
    }
    expect(dual.root).toBeUndefined();
  });

  it('keeps the most critical status when multiple stories aggregate', () => {
    const wideData = {
      ...data,
      comp: { ...data.comp, children: ['comp--a', 'comp--b'] },
      'comp--b': { ...data['comp--a'], id: 'comp--b', name: 'B' },
    };
    const dual = getGroupDualStatus(wideData, {
      'comp--a': { vitest: makeStatus('comp--a', 'vitest', 'status-value:warning') },
      'comp--b': { vitest: makeStatus('comp--b', 'vitest', 'status-value:error') },
    });
    expect(dual.comp.test.value).toBe('status-value:error');
    expect(dual.comp.test.storyId).toBe('comp--b');
  });

  it('excludes review-typed statuses from both slots', () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': {
        'storybook/review': makeStatus('comp--a', 'storybook/review', 'status-value:reviewing'),
      },
    });
    expect(dual['comp--a']).toBeUndefined();
  });
});
