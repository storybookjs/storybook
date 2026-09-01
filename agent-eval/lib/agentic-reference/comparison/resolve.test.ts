import { vol } from 'memfs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  comparisonSlug,
  knownWorkflows,
  resolveCase,
  resolvePlanScope,
  resolveTreatments,
  resolveWorkflows,
} from './resolve.ts';

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...memfs.fs, default: memfs.fs };
});

afterEach(() => {
  vol.reset();
});

describe('resolveCase', () => {
  it('resolves short, full, and experiment names to the same case', () => {
    const expected = {
      caseName: 'cc-do-dont-opus-high',
      experiment: 'agentic-ref-cc-do-dont-opus-high',
      shortName: 'do-dont',
      // The registry's user-facing definition rides along into manifests;
      // its wording lives in cases.ts and is not pinned here.
      description: expect.any(String),
    };
    expect(resolveCase('do-dont')).toEqual(expected);
    expect(resolveCase('cc-do-dont-opus-high')).toEqual(expected);
    expect(resolveCase('agentic-ref-cc-do-dont-opus-high')).toEqual(expected);
  });

  it('throws on unknown names, listing known short names', () => {
    expect(() => resolveCase('nope')).toThrow(/Unknown case "nope"/);
    expect(() => resolveCase('nope')).toThrow(/do-dont/);
  });
});

describe('resolveTreatments', () => {
  const control = resolveCase('control-none');

  it('expands all/nothing to non-control cases with data, sorted', () => {
    const withData = [
      'agentic-ref-cc-do-dont-opus-high',
      'agentic-ref-cc-full-opus-high',
      'agentic-ref-cc-control-none-opus-high',
    ];
    const names = resolveTreatments([], control, withData).map((c) => c.shortName);
    expect(names).toEqual(['do-dont', 'full']);
    expect(resolveTreatments(['all'], control, withData).map((c) => c.shortName)).toEqual(names);
  });

  it('rejects the control in the treatment list', () => {
    expect(() => resolveTreatments(['control-none', 'full'], control, [])).toThrow(/control/);
  });

  it('deduplicates explicit treatment list by caseName', () => {
    expect(resolveTreatments(['full', 'full'], control, []).map((c) => c.shortName)).toEqual([
      'full',
    ]);
  });
});

describe('workflows', () => {
  it('lists 7xx fixture dirs', () => {
    vol.fromJSON({
      '/evals/701-new-ui-flow/PROMPT.md': '',
      '/evals/703-fix-bug-flow/PROMPT.md': '',
      '/evals/801-other/PROMPT.md': '',
    });
    expect(knownWorkflows('/evals')).toEqual(['701-new-ui-flow', '703-fix-bug-flow']);
  });

  it('resolves numeric prefixes and full names; null for auto mode', () => {
    const known = ['701-new-ui-flow', '703-fix-bug-flow'];
    expect(resolveWorkflows(['703', '701'], known)).toEqual([
      '701-new-ui-flow',
      '703-fix-bug-flow',
    ]);
    expect(resolveWorkflows(['701-new-ui-flow'], known)).toEqual(['701-new-ui-flow']);
    expect(resolveWorkflows(['all'], known)).toEqual(known);
    expect(resolveWorkflows([], known)).toBeNull();
    expect(() => resolveWorkflows(['799'], known)).toThrow(/701-new-ui-flow/);
  });
});

describe('resolvePlanScope', () => {
  const control = resolveCase('control-none');

  it('maps the plan arms minus the control to treatments, and sorts its evals', () => {
    const scope = resolvePlanScope(
      {
        experiments: [
          'agentic-ref-cc-full-opus-high',
          'agentic-ref-cc-control-none-opus-high',
          'agentic-ref-cc-do-dont-opus-high',
        ],
        evals: ['703-fix-bug-flow', '701-new-ui-flow'],
      },
      control
    );
    expect(scope.treatments.map((c) => c.shortName)).toEqual(['full', 'do-dont']);
    expect(scope.workflows).toEqual(['701-new-ui-flow', '703-fix-bug-flow']);
  });

  it('rejects a plan that names no case besides the control', () => {
    expect(() =>
      resolvePlanScope(
        { experiments: ['agentic-ref-cc-control-none-opus-high'], evals: ['701-new-ui-flow'] },
        control
      )
    ).toThrow(/no case besides the control/);
  });
});

describe('comparisonSlug', () => {
  it('builds the deterministic slug', () => {
    const control = resolveCase('control-none');
    const treatments = [resolveCase('full'), resolveCase('do-dont')];
    expect(comparisonSlug(control, treatments, ['703-fix-bug-flow', '701-new-ui-flow'])).toBe(
      'control-none_vs_do-dont+full@701+703'
    );
  });
});
