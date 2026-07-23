import { describe, expect, it } from 'vitest';

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { compareArgTypes } from './argtypes.ts';

const argTypes = (entries: StrictArgTypes): StrictArgTypes => entries;

describe('compareArgTypes', () => {
  it('fails when a baseline arg is missing from the candidate', () => {
    const baseline = argTypes({
      size: { name: 'size', table: { category: 'props' }, type: { name: 'string' } },
    });
    const violations = compareArgTypes(baseline, argTypes({}));
    expect(violations).toEqual([expect.objectContaining({ arg: 'size', kind: 'lost-arg' })]);
  });

  it('passes when the candidate has keys the baseline lacks', () => {
    const candidate = argTypes({
      size: { name: 'size', type: { name: 'string' } },
      extra: { name: 'extra', type: { name: 'boolean' } },
    });
    expect(
      compareArgTypes(argTypes({ size: { name: 'size', type: { name: 'string' } } }), candidate)
    ).toEqual([]);
  });

  it('fails when a union of quoted literals collapses to string', () => {
    // The committed props-union-enum shape: union members are other-typed with quoted values.
    const baseline = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          required: true,
          value: [
            { name: 'other', value: '"small"' },
            { name: 'other', value: '"medium"' },
            { name: 'other', value: '"large"' },
          ],
        },
      },
    });
    const candidate = argTypes({ size: { name: 'size', type: { name: 'string' } } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'type-fidelity' }),
    ]);
  });

  it('passes when an other catch-all becomes a structured type', () => {
    // The committed Angular empty-enum shape is the canonical added-precision baseline.
    const baseline = argTypes({
      data: { name: 'data', type: { name: 'other', value: 'empty-enum' } },
    });
    const candidate = argTypes({
      data: { name: 'data', type: { name: 'enum', value: ['a', 'b'] } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('passes other-to-other when the normalized value is unchanged', () => {
    const baseline = argTypes({
      clicked: { name: 'clicked', type: { name: 'other', value: 'void' } },
    });
    const candidate = argTypes({
      clicked: { name: 'clicked', type: { name: 'other', value: 'void' } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('fails other-to-other when the value changes laterally', () => {
    const baseline = argTypes({
      data: { name: 'data', type: { name: 'other', value: 'empty-enum' } },
    });
    const candidate = argTypes({
      data: { name: 'data', type: { name: 'other', value: 'something-else' } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'data', kind: 'type-fidelity' }),
    ]);
  });

  it('fails when a structured baseline type collapses to an other catch-all', () => {
    const baseline = argTypes({
      status: {
        name: 'status',
        type: { name: 'union', value: [{ name: 'string' }, { name: 'number' }] },
      },
    });
    const candidate = argTypes({
      status: { name: 'status', type: { name: 'other', value: 'empty-enum' } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'status', kind: 'type-fidelity' }),
    ]);
  });

  it('fails when the baseline has a type and the candidate has none', () => {
    const baseline = argTypes({ size: { name: 'size', type: { name: 'string' } } });
    const candidate = argTypes({ size: { name: 'size' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'lost-type' }),
    ]);
  });

  it('passes when the baseline has no type at all', () => {
    const baseline = argTypes({ size: { name: 'size' } });
    const candidate = argTypes({ size: { name: 'size' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('fails when a baseline description is lost', () => {
    const baseline = argTypes({
      label: { name: 'label', description: 'The text shown on the badge.' },
    });
    const candidate = argTypes({ label: { name: 'label' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'label', kind: 'lost-description' }),
    ]);
  });

  it('does not require a candidate description for a whitespace-only baseline description', () => {
    // Legacy Angular records "\n" for undocumented members.
    const baseline = argTypes({ count: { name: 'count', description: '\n' } });
    const candidate = argTypes({ count: { name: 'count' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('never compares description content', () => {
    const baseline = argTypes({ label: { name: 'label', description: 'Old words.' } });
    const candidate = argTypes({ label: { name: 'label', description: 'Completely new words.' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('fails when a baseline default value is lost', () => {
    const baseline = argTypes({
      label: { name: 'label', table: { defaultValue: { summary: 'Badge' } } },
    });
    const candidate = argTypes({ label: { name: 'label', table: {} } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'label', kind: 'lost-default' }),
    ]);
  });

  it('treats a NaN baseline default as present, so dropping it fails', () => {
    // Eight committed Angular files record { summary: NaN }; a truthy presence check would
    // read them as absent on both sides and let OSA drop the recorded default silently.
    const baseline = argTypes({
      count: {
        name: 'count',
        table: { defaultValue: { summary: Number.NaN as unknown as string } },
      },
    });
    const candidate = argTypes({ count: { name: 'count' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-default' }),
    ]);
  });

  it('treats explicit undefined summaries as absent on both sides', () => {
    // The corpus shape { "summary": undefined } records no default; symmetry must hold.
    const baseline = argTypes({
      data: { name: 'data', table: { defaultValue: { summary: undefined } } },
    });
    const candidate = argTypes({ data: { name: 'data' } });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('passes when the default moves between the two recorded locations', () => {
    const tableOnly = argTypes({
      count: { name: 'count', table: { defaultValue: { summary: '5' } } },
    });
    const topLevelOnly = argTypes({ count: { name: 'count', defaultValue: 5 } });
    expect(compareArgTypes(tableOnly, topLevelOnly)).toEqual([]);
    expect(compareArgTypes(topLevelOnly, tableOnly)).toEqual([]);
  });

  it('never compares default value contents', () => {
    const baseline = argTypes({
      count: { name: 'count', table: { defaultValue: { summary: '5' } } },
    });
    const candidate = argTypes({
      count: { name: 'count', table: { defaultValue: { summary: '9000' } } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('passes an enum superset and fails an enum subset', () => {
    const baseline = argTypes({
      variant: { name: 'variant', type: { name: 'enum', value: ['small', 'large'] } },
    });
    const superset = argTypes({
      variant: { name: 'variant', type: { name: 'enum', value: ['small', 'medium', 'large'] } },
    });
    const subset = argTypes({
      variant: { name: 'variant', type: { name: 'enum', value: ['small'] } },
    });
    expect(compareArgTypes(baseline, superset)).toEqual([]);
    expect(compareArgTypes(baseline, subset)).toEqual([
      expect.objectContaining({ arg: 'variant', kind: 'type-fidelity' }),
    ]);
  });

  it('normalizes quoted, bare, and literal members to the same member set', () => {
    // Vue records union members as other-typed '"small"'; Angular resolves the same source
    // type to enum ['small']; OSA may emit literal members. All three must count as equal.
    const quotedOthers = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'other', value: '"small"' },
            { name: 'other', value: '"medium"' },
          ],
        },
      },
    });
    const bareEnum = argTypes({
      size: { name: 'size', type: { name: 'enum', value: ['small', 'medium'] } },
    });
    const literalUnion = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'literal', value: 'small' },
            { name: 'literal', value: 'medium' },
          ],
        },
      },
    });
    expect(compareArgTypes(quotedOthers, bareEnum)).toEqual([]);
    expect(compareArgTypes(quotedOthers, literalUnion)).toEqual([]);
    expect(compareArgTypes(bareEnum, literalUnion)).toEqual([]);
  });

  it('accepts any candidate object for an empty-object baseline value', () => {
    // Vue emits value: {} deliberately - "not extracted", not "no properties".
    const baseline = argTypes({
      config: { name: 'config', type: { name: 'object', value: {} } },
    });
    const candidate = argTypes({
      config: {
        name: 'config',
        type: { name: 'object', value: { depth: { name: 'number' } } },
      },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('recurses into object values and fails when a nested type collapses', () => {
    const baseline = argTypes({
      config: {
        name: 'config',
        type: {
          name: 'object',
          value: {
            mode: {
              name: 'union',
              value: [
                { name: 'other', value: '"a"' },
                { name: 'other', value: '"b"' },
              ],
            },
          },
        },
      },
    });
    const candidate = argTypes({
      config: {
        name: 'config',
        type: { name: 'object', value: { mode: { name: 'string' } } },
      },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'config', kind: 'type-fidelity' }),
    ]);
  });

  it('fails when an object loses a key from its value shape', () => {
    const baseline = argTypes({
      config: {
        name: 'config',
        type: { name: 'object', value: { depth: { name: 'number' } } },
      },
    });
    const candidate = argTypes({
      config: { name: 'config', type: { name: 'object', value: {} } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'config', kind: 'type-fidelity' }),
    ]);
  });

  it('recurses into array values and fails when the element type collapses', () => {
    const baseline = argTypes({
      sizes: {
        name: 'sizes',
        type: { name: 'array', value: { name: 'enum', value: ['s', 'l'] } },
      },
    });
    const candidate = argTypes({
      sizes: { name: 'sizes', type: { name: 'array', value: { name: 'string' } } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'sizes', kind: 'type-fidelity' }),
    ]);
  });

  it('fails when union members individually collapse to string inside a surviving union wrapper', () => {
    const baseline = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'other', value: '"small"' },
            { name: 'other', value: '"medium"' },
            { name: 'other', value: '"large"' },
          ],
        },
      },
    });
    const sameLength = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [{ name: 'string' }, { name: 'string' }, { name: 'string' }],
        },
      },
    });
    const singleGeneric = argTypes({
      size: { name: 'size', type: { name: 'union', value: [{ name: 'string' }] } },
    });
    expect(compareArgTypes(baseline, sameLength)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'type-fidelity' }),
    ]);
    expect(compareArgTypes(baseline, singleGeneric)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'type-fidelity' }),
    ]);
  });

  it('passes when a quoted-literal other becomes a structured literal or a covering union', () => {
    const baseline = argTypes({
      size: { name: 'size', type: { name: 'other', value: '"small"' } },
    });
    const literal = argTypes({
      size: { name: 'size', type: { name: 'literal', value: 'small' } },
    });
    const coveringEnum = argTypes({
      size: { name: 'size', type: { name: 'enum', value: ['small', 'large'] } },
    });
    expect(compareArgTypes(baseline, literal)).toEqual([]);
    expect(compareArgTypes(baseline, coveringEnum)).toEqual([]);
  });

  it('fails when a quoted-literal other collapses to a bare scalar', () => {
    const baseline = argTypes({
      size: { name: 'size', type: { name: 'other', value: '"small"' } },
    });
    const candidate = argTypes({ size: { name: 'size', type: { name: 'string' } } });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'type-fidelity' }),
    ]);
  });

  it('passes an unquoted catch-all other becoming a bare scalar', () => {
    const baseline = argTypes({
      clicked: { name: 'clicked', type: { name: 'other', value: 'void' } },
    });
    const candidate = argTypes({ clicked: { name: 'clicked', type: { name: 'string' } } });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('passes when a candidate union keeps every literal member and adds a scalar', () => {
    const baseline = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'other', value: '"small"' },
            { name: 'other', value: '"medium"' },
          ],
        },
      },
    });
    const widened = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'literal', value: 'small' },
            { name: 'literal', value: 'medium' },
            { name: 'string' },
          ],
        },
      },
    });
    expect(compareArgTypes(baseline, widened)).toEqual([]);
  });

  it('fails when an array element union degrades its literal members', () => {
    const baseline = argTypes({
      sizes: {
        name: 'sizes',
        type: {
          name: 'array',
          value: { name: 'union', value: [{ name: 'other', value: '"s"' }] },
        },
      },
    });
    const candidate = argTypes({
      sizes: {
        name: 'sizes',
        type: { name: 'array', value: { name: 'union', value: [{ name: 'string' }] } },
      },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'sizes', kind: 'type-fidelity' }),
    ]);
  });

  it('compares tuples positionally', () => {
    const tuple = (value: object[]) =>
      argTypes({ pair: { name: 'pair', type: { name: 'tuple', value } as never } });
    const baseline = tuple([{ name: 'string' }, { name: 'number' }]);
    expect(compareArgTypes(baseline, tuple([{ name: 'number' }, { name: 'string' }]))).toEqual([
      expect.objectContaining({ arg: 'pair', kind: 'type-fidelity' }),
    ]);
    expect(compareArgTypes(baseline, tuple([{ name: 'string' }]))).toEqual([
      expect.objectContaining({ arg: 'pair', kind: 'type-fidelity' }),
    ]);
    expect(
      compareArgTypes(
        baseline,
        tuple([{ name: 'string' }, { name: 'number' }, { name: 'boolean' }])
      )
    ).toEqual([]);
  });

  it('lets a catch-all union member improve into a structured member', () => {
    // The canonical empty-enum improvement must also pass one union-member level deep.
    const baseline = argTypes({
      data: {
        name: 'data',
        type: { name: 'union', value: [{ name: 'other', value: 'empty-enum' }] },
      },
    });
    const candidate = argTypes({
      data: { name: 'data', type: { name: 'union', value: [{ name: 'literal', value: 'small' }] } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('still fails a literal union losing a member after the member-set rule falls through', () => {
    const baseline = argTypes({
      size: {
        name: 'size',
        type: {
          name: 'union',
          value: [
            { name: 'literal', value: 'small' },
            { name: 'literal', value: 'large' },
          ],
        },
      },
    });
    const candidate = argTypes({
      size: { name: 'size', type: { name: 'union', value: [{ name: 'literal', value: 'small' }] } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'size', kind: 'type-fidelity' }),
    ]);
  });

  it('allows extra members in a same-kind union', () => {
    const baseline = argTypes({
      status: {
        name: 'status',
        type: { name: 'union', value: [{ name: 'string' }, { name: 'number' }] },
      },
    });
    const candidate = argTypes({
      status: {
        name: 'status',
        type: {
          name: 'union',
          value: [{ name: 'string' }, { name: 'number' }, { name: 'boolean' }],
        },
      },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('ignores required flips in both notions', () => {
    // Legacy Angular hardcodes required: true for every input (#28706); comparing the flag
    // would entrench the lie.
    const baseline = argTypes({
      count: {
        name: 'count',
        table: { type: { required: true, summary: 'number' } as never },
        type: { name: 'number', required: true },
      },
    });
    const candidate = argTypes({
      count: {
        name: 'count',
        table: { type: { required: false, summary: 'number' } as never },
        type: { name: 'number', required: false },
      },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('ignores table category changes', () => {
    const baseline = argTypes({
      focus: { name: 'focus', table: { category: 'expose' }, type: { name: 'function' } },
    });
    const candidate = argTypes({
      focus: { name: 'focus', table: { category: 'exposed' }, type: { name: 'function' } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
  });

  it('reports every violation, not only the first', () => {
    const baseline = argTypes({
      one: { name: 'one', type: { name: 'string' } },
      two: { name: 'two', description: 'Documented.' },
    });
    const candidate = argTypes({ two: { name: 'two' } });
    const violations = compareArgTypes(baseline, candidate);
    expect(violations).toEqual([
      expect.objectContaining({ arg: 'one', kind: 'lost-arg' }),
      expect.objectContaining({ arg: 'two', kind: 'lost-description' }),
    ]);
    for (const violation of violations) {
      expect(violation.message).not.toContain('\n');
    }
  });
});
