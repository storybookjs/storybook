import { describe, expect, it } from 'vitest';

import { compareBaselines, formatFindings } from './compare-baselines.ts';
import type { SandboxBaseline } from './read-static-docgen.ts';

type ArgTypes = NonNullable<SandboxBaseline['argTypes']>;

const arg = (name: string, type: ArgTypes[string]['type'] = { name: 'string' }): ArgTypes =>
  ({ [name]: { name, type, table: { category: 'inputs' } } }) as ArgTypes;

const documented = (overrides: Partial<SandboxBaseline> = {}): SandboxBaseline => ({
  id: 'button',
  name: 'ButtonComponent',
  path: './button.stories.ts',
  jsDocTags: {},
  argTypes: arg('label'),
  ...overrides,
});

const undocumented = (overrides: Partial<SandboxBaseline> = {}): SandboxBaseline => ({
  id: 'button',
  name: 'ButtonComponent',
  path: './button.stories.ts',
  jsDocTags: {},
  error: { name: 'ComponentNotDocumented', message: 'not in the scan' },
  ...overrides,
});

describe('compareBaselines', () => {
  it('reports nothing when both sides agree', () => {
    expect(compareBaselines({ button: documented() }, { button: documented() })).toEqual([]);
  });

  it('flags a component that stopped being documented as a regression', () => {
    const findings = compareBaselines({ button: documented() }, { button: undocumented() });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'regression', kind: 'docgen-lost' });
    expect(findings[0].message).toContain('ComponentNotDocumented');
  });

  it('does not restate every lost arg once docgen-lost explains it', () => {
    const findings = compareBaselines(
      { button: documented({ argTypes: { ...arg('a'), ...arg('b'), ...arg('c') } }) },
      { button: undocumented() }
    );

    expect(findings.map((finding) => finding.kind)).toEqual(['docgen-lost']);
  });

  it('flags a component that became documented as a change, not a regression', () => {
    const findings = compareBaselines({ button: undocumented() }, { button: documented() });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'change', kind: 'docgen-gained' });
  });

  it('flags a dropped raw false or null default as a regression', () => {
    // A raw false / null summary is a genuine default here, so losing one must read as a
    // regression rather than as neutral drift.
    for (const summary of [false, null]) {
      const withDefault: ArgTypes = {
        label: {
          name: 'label',
          type: { name: 'boolean' },
          table: { category: 'inputs', defaultValue: { summary: summary as unknown as string } },
        },
      } as ArgTypes;
      const findings = compareBaselines(
        { button: documented({ argTypes: withDefault }) },
        { button: documented({ argTypes: arg('label', { name: 'boolean' }) }) }
      );

      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'regression',
          kind: 'argtypes',
          message: expect.stringContaining('label lost its default'),
        })
      );
    }
  });

  it('names the affected arg and sub-field for neutral argTypes drift', () => {
    const withDescription = (description: string): ArgTypes =>
      ({
        label: {
          name: 'label',
          type: { name: 'string' },
          description,
          table: { category: 'inputs' },
        },
      }) as ArgTypes;
    const findings = compareBaselines(
      { button: documented({ argTypes: withDescription('Old words.') }) },
      { button: documented({ argTypes: withDescription('New words.') }) }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'change', kind: 'argtypes' });
    expect(findings[0].message).toBe('argTypes differs: label (description)');
  });

  it('flags an arg present in the baseline but missing from the build', () => {
    const findings = compareBaselines(
      { button: documented({ argTypes: { ...arg('label'), ...arg('size') } }) },
      { button: documented({ argTypes: arg('label') }) }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'regression', kind: 'argtypes' });
    expect(findings[0].message).toContain('size removed');
  });

  it('accepts an added arg as a change so an improvement is not read as a failure to fix', () => {
    const findings = compareBaselines(
      { button: documented({ argTypes: arg('label') }) },
      { button: documented({ argTypes: { ...arg('label'), ...arg('size') } }) }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'change', kind: 'argtypes' });
    expect(findings[0].message).toBe('argTypes differs: size (added)');
  });

  it('reports a type that gained fidelity as a change, not a regression', () => {
    // The gate is exact-match, so even an unambiguous improvement fails and is adopted by
    // re-recording. Calling it a regression would send a reviewer hunting for a bug that is not
    // there.
    const findings = compareBaselines(
      { button: documented({ argTypes: arg('size', { name: 'other', value: 'empty-enum' }) }) },
      { button: documented({ argTypes: arg('size', { name: 'enum', value: ['sm', 'lg'] }) }) }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'change', kind: 'argtypes' });
    expect(findings[0].message).toBe('argTypes differs: size (type)');
  });

  it('flags a component missing from the build as a regression', () => {
    const findings = compareBaselines({ button: documented() }, {});

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'regression', kind: 'component-removed' });
  });

  it('flags a component absent from the baseline as a change', () => {
    const findings = compareBaselines({}, { button: documented() });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'change', kind: 'component-added' });
  });

  it('flags a resolution that swapped to a different component', () => {
    const findings = compareBaselines(
      { button: documented({ name: 'ButtonComponent' }) },
      { button: documented({ name: 'OtherButtonComponent' }) }
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'field-changed' });
    expect(findings[0].message).toContain('name differs');
  });

  it('ignores key ordering, which a producer may change without changing meaning', () => {
    const findings = compareBaselines(
      { button: { ...documented(), jsDocTags: { a: ['1'], b: ['2'] } } },
      { button: { ...documented(), jsDocTags: { b: ['2'], a: ['1'] } } }
    );

    expect(findings).toEqual([]);
  });
});

describe('formatFindings', () => {
  it('lists regressions before changes', () => {
    const output = formatFindings(
      compareBaselines(
        { gone: documented(), kept: undocumented() },
        { kept: documented(), fresh: documented() }
      )
    );

    expect(output.indexOf('regression(s)')).toBeLessThan(output.indexOf('change(s)'));
  });
});
