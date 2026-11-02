// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { StatusValue } from 'storybook/internal/types';

import { mockDataset } from '../components/sidebar/mockdata.ts';
import { getGroupDualStatus, getGroupStatus, getMostCriticalStatusValue } from './status.tsx';

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

  it("splits a leaf's statuses into the change slot and the test slot", () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': {
        'storybook/change-detection': makeStatus(
          'comp--a',
          'storybook/change-detection',
          'status-value:modified'
        ),
        vitest: makeStatus('comp--a', 'vitest', 'status-value:error'),
      },
    });
    expect(dual['comp--a'].change.value).toBe('status-value:modified');
    expect(dual['comp--a'].test.value).toBe('status-value:error');
  });

  it('keeps the review status out of both slots', () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': {
        [REVIEW_STATUS_TYPE_ID]: makeStatus(
          'comp--a',
          REVIEW_STATUS_TYPE_ID,
          'status-value:reviewing'
        ),
        vitest: makeStatus('comp--a', 'vitest', 'status-value:success'),
      },
    });
    expect(dual['comp--a'].change.value).toBe('status-value:unknown');
    expect(dual['comp--a'].test.value).toBe('status-value:success');
  });

  it('keeps the most critical value inside the change slot: new beats modified beats affected', () => {
    const dual = getGroupDualStatus(data, {
      'comp--a': {
        first: makeStatus('comp--a', 'storybook/change-detection', 'status-value:affected'),
        second: makeStatus('comp--a', 'storybook/change-detection', 'status-value:modified'),
        third: makeStatus('comp--a', 'storybook/change-detection', 'status-value:new'),
      },
    });
    expect(dual['comp--a'].change.value).toBe('status-value:new');
    expect(dual['comp--a'].test.value).toBe('status-value:unknown');
  });

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
