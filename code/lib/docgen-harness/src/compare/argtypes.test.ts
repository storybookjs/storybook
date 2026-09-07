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

  it('waives a lost ES-private member, which no modern engine is expected to record', () => {
    const baseline = argTypes({ '#secret': { name: '#secret', type: { name: 'string' } } });

    expect(compareArgTypes(baseline, argTypes({}))).toEqual([]);
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

  it('waives invented legacy defaults (NaN, its JSON null round-trip, raw false) only under legacyBaseline', () => {
    // The no-invented-NaN gap marker (angular-legacy-gaps.test.ts) pins NaN and raw false as
    // legacy fabrications for members without a default; the sandbox baselines carry the same
    // NaN JSON-serialized to null. A candidate that stops inventing them loses nothing - but only
    // when the baseline is a legacy compodoc recording where fabrication and genuine value are
    // indistinguishable.
    for (const summary of [Number.NaN, null, false]) {
      const baseline = argTypes({
        count: {
          name: 'count',
          table: { defaultValue: { summary: summary as unknown as string } },
        },
      });
      const candidate = argTypes({ count: { name: 'count' } });
      expect(compareArgTypes(baseline, candidate, { legacyBaseline: true })).toEqual([]);
    }
  });

  it('does not generically waive numeric initializer source from a legacy baseline', () => {
    const baseline = argTypes({
      timeoutMs: {
        name: 'timeoutMs',
        table: { defaultValue: { summary: '5 * 60 * 1000' } },
      },
    });
    const candidate = argTypes({ timeoutMs: { name: 'timeoutMs' } });

    expect(compareArgTypes(baseline, candidate, { legacyBaseline: true })).toEqual([
      expect.objectContaining({ arg: 'timeoutMs', kind: 'lost-default' }),
    ]);
  });

  it('flags dropped raw false, null, and NaN defaults outside legacyBaseline', () => {
    // A non-legacy engine records raw false / null only for a genuine `= false` / `= null`
    // default, so dropping one is a lost default in the default (strict) mode.
    for (const summary of [false, null, Number.NaN]) {
      const baseline = argTypes({
        count: {
          name: 'count',
          table: { defaultValue: { summary: summary as unknown as string } },
        },
      });
      const candidate = argTypes({ count: { name: 'count' } });
      expect(compareArgTypes(baseline, candidate)).toEqual([
        expect.objectContaining({ arg: 'count', kind: 'lost-default' }),
      ]);
    }
  });

  it('accepts a modern candidate default of raw false/null against a legacy baseline', () => {
    // The invented-default waiver describes the legacy side only. A modern candidate that records
    // `false` (e.g. `input(false, { transform: booleanAttribute })`) HAS a default; waiving it on
    // the candidate side manufactured lost-default findings for genuinely-defaulted args.
    for (const candidateSummary of [false, null]) {
      const baseline = argTypes({
        count: {
          name: 'count',
          table: { defaultValue: { summary: 'false, { transform: booleanAttribute }' } },
        },
      });
      const candidate = argTypes({
        count: {
          name: 'count',
          table: { defaultValue: { summary: candidateSummary as unknown as string } },
        },
      });
      expect(compareArgTypes(baseline, candidate, { legacyBaseline: true })).toEqual([]);
    }
  });

  it('protects string and non-false scalar defaults in both modes', () => {
    // 'false' as a string is another engine's genuine recording, not the Angular raw-value shape.
    for (const summary of ['false', 'NaN', 0, true]) {
      const baseline = argTypes({
        count: {
          name: 'count',
          table: { defaultValue: { summary: summary as unknown as string } },
        },
      });
      const candidate = argTypes({ count: { name: 'count' } });
      for (const options of [undefined, { legacyBaseline: true }]) {
        expect(compareArgTypes(baseline, candidate, options)).toEqual([
          expect.objectContaining({ arg: 'count', kind: 'lost-default' }),
        ]);
      }
    }
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

  it('passes when a stub for an unextracted type becomes anything at all', () => {
    // The three corpus markers for "nothing was extracted": Angular's empty-enum, Vue's
    // undefined for runtime array props, and the empty string.
    for (const value of ['empty-enum', 'undefined', '']) {
      const baseline = argTypes({ data: { name: 'data', type: { name: 'other', value } } });
      const candidate = argTypes({ data: { name: 'data', type: { name: 'boolean' } } });
      expect(compareArgTypes(baseline, candidate)).toEqual([]);
    }
  });

  it('fails when an other stub naming a real type collapses to an unrelated scalar', () => {
    // Half the corpus is other-typed free text that still names something: TreeNode, ButtonSize,
    // Array([object Object]), { theme: string; dense: boolean }. Swapping in a bare scalar is a
    // lateral change, not added precision, so it needs a reviewed re-record.
    for (const value of ['TreeNode', 'Array([object Object])']) {
      const baseline = argTypes({ node: { name: 'node', type: { name: 'other', value } } });
      const candidate = argTypes({ node: { name: 'node', type: { name: 'string' } } });
      expect(compareArgTypes(baseline, candidate)).toEqual([
        expect.objectContaining({ arg: 'node', kind: 'type-fidelity' }),
      ]);
    }
  });

  it('passes when an other stub gains structure or resolves to the scalar it named', () => {
    const stub = (value: string) =>
      argTypes({ node: { name: 'node', type: { name: 'other', value } } });
    expect(
      compareArgTypes(
        stub('Array([object Object])'),
        argTypes({ node: { name: 'node', type: { name: 'array', value: { name: 'string' } } } })
      )
    ).toEqual([]);
    expect(
      compareArgTypes(
        stub('string'),
        argTypes({ node: { name: 'node', type: { name: 'string' } } })
      )
    ).toEqual([]);
  });

  it('fails when a union of other stubs collapses onto one unrelated member', () => {
    const baseline = argTypes({
      shape: {
        name: 'shape',
        type: {
          name: 'union',
          value: [
            { name: 'other', value: 'ButtonSize' },
            { name: 'other', value: 'ButtonVariant' },
          ],
        },
      },
    });
    const candidate = argTypes({
      shape: { name: 'shape', type: { name: 'union', value: [{ name: 'string' }] } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([
      expect.objectContaining({ arg: 'shape', kind: 'type-fidelity' }),
    ]);
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

  it('fails when a recorded table.type.summary disappears, in every mode', () => {
    const baseline = argTypes({
      count: { name: 'count', table: { type: { summary: 'number' } } },
    });
    for (const candidate of [
      argTypes({ count: { name: 'count', table: { type: {} } } }),
      argTypes({ count: { name: 'count', table: {} } }),
      argTypes({ count: { name: 'count', table: { type: { summary: '' } } } }),
    ]) {
      for (const options of [undefined, { legacyBaseline: true }, { strictTable: true }]) {
        expect(compareArgTypes(baseline, candidate, options)).toEqual([
          expect.objectContaining({ arg: 'count', kind: 'lost-summary' }),
        ]);
      }
    }
  });

  it('ignores table.type.summary text changes except under strictTable', () => {
    const baseline = argTypes({
      count: { name: 'count', table: { type: { summary: 'number' } } },
    });
    const candidate = argTypes({
      count: { name: 'count', table: { type: { summary: 'string' } } },
    });
    expect(compareArgTypes(baseline, candidate)).toEqual([]);
    expect(compareArgTypes(baseline, candidate, { legacyBaseline: true })).toEqual([]);
    expect(compareArgTypes(baseline, candidate, { strictTable: true })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'changed-summary' }),
    ]);
  });

  // `canonicalType` ignores `required`, so the type-fidelity comparison cannot see this flip and
  // this gate is the only thing standing between a lost required flag and a laundered `-u`.
  it('flags a required true->false flip only under strictTable', () => {
    const required = (value: boolean) =>
      argTypes({
        count: { name: 'count', type: { name: 'number', required: value } },
      });
    const missing = argTypes({
      count: { name: 'count', type: { name: 'number' } },
    });
    expect(compareArgTypes(required(true), required(false))).toEqual([]);
    expect(compareArgTypes(required(true), required(false), { strictTable: true })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-required' }),
    ]);
    expect(compareArgTypes(required(true), missing, { strictTable: true })).toEqual([
      expect.objectContaining({ arg: 'count', kind: 'lost-required' }),
    ]);
    // The loosening direction only: gaining required is not a violation.
    expect(compareArgTypes(required(false), required(true), { strictTable: true })).toEqual([]);
  });

  it('fails when a named other stub collapses to an empty structure', () => {
    // An empty enum/union/object records nothing; swapping it in for free text that named a real
    // type would let an extraction regression pass as "structure".
    const stub = argTypes({ node: { name: 'node', type: { name: 'other', value: 'TreeNode' } } });
    for (const emptyStructure of [
      { name: 'enum', value: [] },
      { name: 'union', value: [] },
      { name: 'intersection', value: [] },
      { name: 'tuple', value: [] },
      { name: 'object', value: {} },
    ] as const) {
      const candidate = argTypes({ node: { name: 'node', type: emptyStructure as never } });
      expect(compareArgTypes(stub, candidate)).toEqual([
        expect.objectContaining({ arg: 'node', kind: 'type-fidelity' }),
      ]);
    }
  });

  it('accepts a literal for a named other stub only when it matches the stub text', () => {
    const stub = (value: string) =>
      argTypes({ node: { name: 'node', type: { name: 'other', value } } });
    const literal = (value: string) =>
      argTypes({ node: { name: 'node', type: { name: 'literal', value } } });
    expect(compareArgTypes(stub('small'), literal('small'))).toEqual([]);
    expect(compareArgTypes(stub('small'), literal('unrelated'))).toEqual([
      expect.objectContaining({ arg: 'node', kind: 'type-fidelity' }),
    ]);
    // A stub that recorded nothing still accepts any literal.
    expect(compareArgTypes(stub('empty-enum'), literal('anything'))).toEqual([]);
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

  it('compares intersection members like union members', () => {
    const baseline = argTypes({
      merged: {
        name: 'merged',
        type: {
          name: 'intersection',
          value: [{ name: 'other', value: 'SharedProps' }, { name: 'boolean' }],
        },
      },
    });
    const dropped = argTypes({
      merged: { name: 'merged', type: { name: 'intersection', value: [{ name: 'boolean' }] } },
    });
    const resolved = argTypes({
      merged: {
        name: 'merged',
        type: {
          name: 'intersection',
          value: [{ name: 'object', value: { id: { name: 'number' } } }, { name: 'boolean' }],
        },
      },
    });
    expect(compareArgTypes(baseline, dropped)).toEqual([
      expect.objectContaining({ arg: 'merged', kind: 'type-fidelity' }),
    ]);
    expect(compareArgTypes(baseline, resolved)).toEqual([]);
  });

  it('reports every violation, not only the first, each on one line', () => {
    // The Angular jsdoc-tags fixture records a @default value with a trailing newline; a raw
    // newline in the message would break the one-violation-per-line report.
    const baseline = argTypes({
      one: { name: 'one', type: { name: 'string' } },
      two: { name: 'two', description: 'Documented.' },
      three: { name: 'three', table: { defaultValue: { summary: "'steelblue'\n" } } },
    });
    const candidate = argTypes({ two: { name: 'two' }, three: { name: 'three' } });
    const violations = compareArgTypes(baseline, candidate);
    expect(violations).toEqual([
      expect.objectContaining({ arg: 'one', kind: 'lost-arg' }),
      expect.objectContaining({ arg: 'two', kind: 'lost-description' }),
      expect.objectContaining({ arg: 'three', kind: 'lost-default' }),
    ]);
    for (const violation of violations) {
      expect(violation.message).not.toContain('\n');
    }
  });
});
