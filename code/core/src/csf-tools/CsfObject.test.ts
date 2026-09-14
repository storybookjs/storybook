import { afterEach, describe, expect, it, vi } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { loadCsf, printCsf } from './CsfFile.ts';
import { loadConfig } from './ConfigFile.ts';
import type { CsfValue } from './CsfObject.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { expression: 'false', expected: false },
    { expression: '-2.5', expected: -2.5 },
    { expression: '\`dark\`', expected: 'dark' },
    { expression: '("dark" as const) satisfies string', expected: 'dark' },
    { expression: '[1, ...[false, "dark"], null]', expected: [1, false, 'dark', null] },
    {
      expression: '{ ...{ enabled: false }, nested: { values: [1, "dark"] } }',
      expected: { enabled: false, nested: { values: [1, 'dark'] } },
    },
    { expression: '{ ["font-size"]: 12 }', expected: { 'font-size': 12 } },
  ])('reads $expression without changing the file', ({ expression, expected }) => {
    const source = `export default { parameters: ${expression} };`;
    const csf = parse(source);
    const [meta] = csf.objects({ stories: false });

    expect(meta.getValue(['parameters'])).toEqual(expected);
    expect(meta.getValue(['missing'])).toBeUndefined();
    expect(csf.mutationDiagnostics).toEqual([]);
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('reads local constant values through references', () => {
    const csf = parse('const tags = ["autodocs"]; export default { tags };');
    const [meta] = csf.objects({ stories: false });
    expect(meta.getValue(['tags'])).toEqual(['autodocs']);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('keeps local bindings readable after replacing a story expression', () => {
    const csf = parse(`
      const params = { a11y: { element: '#app' } };
      export default {};
      export const Basic = { parameters: params };
    `);
    const [story] = csf.objects({ meta: false });

    expect(story.set(['parameters'], story.get(['parameters']))).toEqual({
      ok: true,
      changed: true,
    });
    expect(story.getValue(['parameters', 'a11y', 'element'])).toBe('#app');
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('returns fresh nested values on every read', () => {
    const csf = parse('export default { parameters: { values: [{ enabled: true }] } };');
    const [meta] = csf.objects({ stories: false });
    const values = meta.getValue(['parameters', 'values']);
    if (!Array.isArray(values)) {
      throw new Error('Expected an array');
    }
    values[0].enabled = false;
    values.push('new');
    expect(meta.getValue(['parameters', 'values'])).toEqual([{ enabled: true }]);
    expect(csf.changed).toBe(false);
  });

  it('reads an own __proto__ field without modifying the returned object prototype', () => {
    const csf = parse('export default { parameters: { ["__proto__"]: { enabled: true } } };');
    const [meta] = csf.objects({ stories: false });
    const value = meta.getValue(['parameters']);
    expect(value).toEqual(JSON.parse('{"__proto__":{"enabled":true}}'));
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });

  it.each([
    'globalThis.csfReadProbe()',
    '{ known: true, dynamic: globalThis.csfReadProbe() }',
    '["known", globalThis.csfReadProbe()]',
    '{ get enabled() { return globalThis.csfReadProbe(); } }',
    'globalThis.csfReadProbe.value',
    '() => globalThis.csfReadProbe()',
  ])('reports an unresolved value without executing %s', (expression) => {
    const probe = vi.fn();
    vi.stubGlobal('csfReadProbe', probe);
    const csf = parse(`export default { parameters: ${expression} };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.getValue(['parameters'])).toBeUndefined();
    expect(probe).not.toHaveBeenCalled();
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-value',
        path: ['parameters'],
      })
    );
    expect(csf.changed).toBe(false);
  });

  it('edits a local object referenced by a story and cleans up the empty parent', () => {
    const csf = parse(
      `const a11y = { element: '#root' }; export default {}; export const Story = { parameters: { a11y } };`
    );
    const [story] = csf.objects({ meta: false });

    story.rename(['parameters', 'a11y', 'element'], 'context');
    expect(story.get(['parameters', 'a11y', 'context'])).toMatchObject({ value: '#root' });
    story.move(['parameters', 'a11y', 'context'], ['globals', 'a11y']);

    const [updated] = parse(printCsf(csf).code).objects({ meta: false });
    expect(updated.get(['parameters'])).toBeUndefined();
    expect(updated.get(['globals', 'a11y'])).toMatchObject({ value: '#root' });
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('renames and transforms a story method without changing it to a property', () => {
    const csf = parse('export default {}; export const Story = { play() { setup(); } };');
    const [story] = csf.objects({ meta: false });
    story.rename(['play'], 'beforeEach');
    story.transform(['beforeEach'], (value) => {
      if (!t.isFunctionExpression(value)) {
        throw new Error('Expected a function expression');
      }
      return {
        ...value,
        body: t.blockStatement([...value.body.body, t.returnStatement(t.booleanLiteral(true))]),
      };
    });
    expect(printCsf(csf).code).toContain('beforeEach()');
    expect(printCsf(csf).code).toContain('return true;');
    expect(story.get(['play'])).toBeUndefined();
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it.each([
    `{ viewport: { defaultViewport: 'mobile' } }`,
    `({ viewport: ({ defaultViewport: 'mobile' } as const) } satisfies Parameters)`,
  ])('removes empty ancestors from %s', (parameters) => {
    const csf = parse(`export default { parameters: ${parameters} };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'viewport', 'defaultViewport'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toBe('export default {};');
    expect(meta.changed).toBe(true);
    expect(csf.changed).toBe(true);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it.each(['docs: {}', '...base', '[field]: true'])(
    'preserves the sibling %s when cleaning up empty parents',
    (sibling) => {
      const csf = parse(`export default {
        parameters: { ${sibling}, viewport: { defaultViewport: 'mobile' } }
      };`);
      const [meta] = csf.objects({ meta: true, stories: false });

      expect(meta.remove(['parameters', 'viewport', 'defaultViewport'])).toEqual({
        ok: true,
        changed: true,
      });
      const output = printCsf(csf).code;
      expect(output).toContain('parameters:');
      expect(output).toContain(sibling);
      expect(meta.getValue(['parameters', 'viewport'])).toEqual(
        sibling === 'docs: {}' ? undefined : {}
      );
      expect(csf.mutationDiagnostics).toEqual([]);
    }
  );

  it.each([
    ['globals', 'viewport', 'value'],
    ['parameters', 'value'],
    ['parameters', 'viewport', 'nested', 'value'],
  ])('cleans up after moving to %j', (...destination) => {
    const csf = parse(`export default {
      parameters: { viewport: { defaultViewport: 'mobile' } }
    };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['parameters', 'viewport', 'defaultViewport'], destination)).toEqual({
      ok: true,
      changed: true,
    });
    const output = parse(printCsf(csf).code);
    const [updated] = output.objects({ meta: true, stories: false });
    expect(updated.get(destination)).toMatchObject({ type: 'StringLiteral', value: 'mobile' });
    if (destination[0] === 'globals') {
      expect(updated.get(['parameters'])).toBeUndefined();
    } else if (destination.length === 2) {
      expect(updated.get(['parameters', 'viewport'])).toBeUndefined();
    }
    expect(printCsf(csf).code).not.toContain('defaultViewport');
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('preserves empty objects when removing or moving a missing field', () => {
    const source = 'export default { parameters: { viewport: {} } };';
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'viewport', 'missing'])).toEqual({
      ok: true,
      changed: false,
    });
    expect(meta.move(['parameters', 'viewport', 'missing'], ['globals', 'viewport'])).toEqual({
      ok: true,
      changed: false,
    });
    expect(printCsf(csf).code).toBe(source);
    expect(csf.changed).toBe(false);
  });

  it('stops cleanup at a CSF2 annotation root', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { viewport: { disable: true } };
    `);
    const [parameters] = csf.objects({ meta: false });

    expect(parameters.remove(['parameters', 'viewport', 'disable'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain('Basic.parameters = {};');
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('moves a nested meta field and preserves its comments', () => {
    const csf = parse(`
      export default {
        parameters: {
          // Keep this explanation with the subtitle.
          componentSubtitle: 'Buttons',
        },
      };
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle']))
      .toMatchInlineSnapshot(`
      {
        "changed": true,
        "ok": true,
      }
    `);
    expect(csf.changed).toBe(true);
    expect(printCsf(csf).code).toMatch(
      /docs: \{\s+\/\/ Keep this explanation with the subtitle\.\s+subtitle: 'Buttons'/
    );
  });

  it.each([
    { value: 42 },
    { value: -2.5 },
    { value: -0 },
    { value: true },
    { value: false },
    { value: 'todo' },
    { value: '' },
    { value: null },
    { value: undefined },
    { value: [] },
    { value: [1, false, 'autodocs', null] },
    { value: {} },
    { value: { nested: { enabled: true, 'font-size': 12 }, levels: [0, ['dark', false]] } },
    { value: { type: 'button', data: { type: 'Identifier', name: 'plainData' } } },
  ] satisfies { value: CsfValue }[])('sets the literal value $value', ({ value }) => {
    const csf = parse('export default { parameters: { existing: true } };');
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['parameters', 'value'], value)).toEqual({ ok: true, changed: true });
    const output = loadConfig(printCsf(csf).code).parse();
    expect(output.getValue(['parameters', 'value'])).toEqual(value);
    expect(output.getValue(['parameters', 'existing'])).toBe(true);
    expect(meta.changed).toBe(true);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('copies nested literal inputs when setting story args', () => {
    const csf = parse('export default {}; export const Story = { args: {} };');
    const [story] = csf.objects({ meta: false });
    const value = { appearance: { dark: true }, labels: ['original'] };

    story.set(['args'], value);
    value.appearance.dark = false;
    value.labels.push('changed');

    const [updated] = parse(printCsf(csf).code).objects({ meta: false });
    expect(updated.get(['args', 'appearance', 'dark'])).toMatchObject({ value: true });
    expect(updated.get(['args', 'labels'])).toMatchObject({
      elements: [{ type: 'StringLiteral', value: 'original' }],
    });
  });

  it('does not expose mutable AST nodes through get or set', () => {
    const csf = parse(`export default { title: 'Original' };`);
    const [meta] = csf.objects({ meta: true, stories: false });
    const value = meta.get(['title']);
    const replacement = t.stringLiteral('Replacement');

    if (t.isStringLiteral(value)) {
      value.value = 'Mutated';
    }
    expect(meta.set(['title'], replacement)).toEqual({ ok: true, changed: true });
    replacement.value = 'Mutated replacement';

    expect(printCsf(csf).code).toContain('title: "Replacement"');
    expect(printCsf(csf).code).not.toContain('Mutated');
  });

  it('discovers an identifier-backed aliased story once', () => {
    const csf = parse(`
      export default { title: 'Example' };
      const Local = { parameters: { componentSubtitle: 'Aliased' } } satisfies Story;
      export { Local as First, Local as Second };
    `);

    const stories = csf.objects({ meta: false, stories: true });

    expect(stories).toHaveLength(1);
    expect(stories[0].target).toEqual({ kind: 'story', exportName: 'First', localName: 'Local' });
    expect(stories[0].get(['parameters', 'componentSubtitle'])).toMatchObject({
      type: 'StringLiteral',
      value: 'Aliased',
    });
  });

  it('uses logical paths for CSF2 parameter assignments', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { a11y: { element: '#root' } };
    `);
    const [parameters] = csf.objects({ meta: false });

    expect(parameters.rename(['parameters', 'a11y', 'element'], 'context')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain(`Basic.parameters = { a11y: { context: '#root' } };`);
  });

  it('rejects repeated CSF2 annotations instead of exposing either object', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { first: true };
      Basic.parameters = { second: true };
    `);

    expect(csf.objects({ meta: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ambiguous-binding',
        target: expect.objectContaining({ kind: 'story-annotation', exportName: 'Basic' }),
      })
    );
  });

  it.each([
    ['spread-field', `{ componentSubtitle: 'Unsafe', ...base }`],
    ['dynamic-key', `{ componentSubtitle: 'Unsafe', [field]: 'Unsafe' }`],
    ['duplicate-field', `{ componentSubtitle: 'One', componentSubtitle: 'Two' }`],
    ['unsupported-member', `{ get componentSubtitle() { return 'Unsafe' } }`],
  ])('rejects %s without changing the source', (code, parameters) => {
    const source = `export default { parameters: ${parameters} };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'componentSubtitle'])).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code },
    });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it.each([
    ['spread', `...base`],
    ['computed key', `[field]: true`],
  ])('mutates a field an earlier %s cannot shadow', (_kind, member) => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Primary = {
        ${member},
        parameters: { a11y: { element: '#root' } },
      };
    `);
    const [primary] = csf.objects({ meta: false, stories: true });

    expect(primary.rename(['parameters', 'a11y', 'element'], 'context')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain(`context: '#root'`);
  });

  it.each([
    ['spread-field', `...base`],
    ['dynamic-key', `[field]: true`],
  ])('rejects a field only %s could provide', (code, member) => {
    const source = `export default { parameters: { ${member} } };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'componentSubtitle'])).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code },
    });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('keeps the original source of nodes reused by a transformed value', () => {
    const csf = parse(`
      export default {
        parameters: {
          backgrounds: { values: [{ name: 'Gray', value: '#CCC' }] },
        },
      };
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.transform(['parameters', 'backgrounds', 'values'], (values) =>
        t.isArrayExpression(values) && t.isExpression(values.elements[0])
          ? t.objectExpression([t.objectProperty(t.identifier('gray'), values.elements[0])])
          : undefined
      )
    ).toEqual({ ok: true, changed: true });
    expect(meta.rename(['parameters', 'backgrounds', 'values'], 'options')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toMatch(/options: \{\s+gray: \{ name: 'Gray', value: '#CCC' \}/);
  });

  it('rejects removing an explicit field that could reveal a spread value', () => {
    const csf = parse(`export default { parameters: { ...base, componentSubtitle: 'Safe' } };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'componentSubtitle'])).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code: 'spread-field' },
    });
    expect(csf.changed).toBe(false);
  });

  it('rejects an occupied move destination without changing the source', () => {
    const source = `export default { parameters: { componentSubtitle: 'Old', docs: { subtitle: 'New' } } };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle'])
    ).toMatchObject({ ok: false, diagnostic: { code: 'occupied-destination' } });
    expect(printCsf(csf).code).toBe(source);
  });

  it('rejects moving a field below itself without changing the source', () => {
    const source = `export default { parameters: { docs: { source: true } } };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['parameters', 'docs'], ['parameters', 'docs', 'subtitle'])).toMatchObject({
      ok: false,
      diagnostic: { code: 'cyclic-move' },
    });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('treats a move to the same path as a no-op', () => {
    const source = `export default { title: 'Example' };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.rename(['title'], 'title')).toEqual({ ok: true, changed: false });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('rejects prototype-setting destination paths', () => {
    const source = `export default { title: 'Example' };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.set(['parameters', '__proto__', 'polluted'], t.booleanLiteral(true))).toMatchObject(
      {
        ok: false,
        diagnostic: { code: 'unsupported-member' },
      }
    );
    expect(printCsf(csf).code).toBe(source);
  });

  it('addresses numeric literal keys by their static string value', () => {
    const csf = parse(`export default { parameters: { 1: 'one' } };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', '1'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain(`1: 'one'`);
  });

  it('rejects reassigned direct exports', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export let Basic = { args: { label: 'First' } };
      Basic = { args: { label: 'Second' } };
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ambiguous-binding',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('reports re-exported story candidates', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export { Basic } from './Basic.stories';
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('selects a retained alias when another alias is excluded', () => {
    const csf = parse(`
      export default { title: 'Example', includeStories: ['Second'] };
      const Local = { args: {} };
      export { Local as First, Local as Second };
    `);
    const [story] = csf.objects({ meta: false, stories: true });

    expect(story.target).toEqual({ kind: 'story', exportName: 'Second', localName: 'Local' });
  });

  it('rejects a reassigned identifier-backed meta object', () => {
    const csf = parse(`
      let meta = { title: 'First' };
      meta = { title: 'Second' };
      export default meta;
    `);

    expect(csf.objects({ meta: true, stories: false })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'ambiguous-binding', target: { kind: 'meta' } })
    );
  });

  it('rejects a reassigned named-default meta object', () => {
    const source = `
      let meta = { title: 'First' };
      meta = { title: 'Second' };
      export { meta as default };
    `;
    const csf = parse(source);

    expect(csf.objects({ meta: true, stories: false })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'ambiguous-binding', target: { kind: 'meta' } })
    );
    expect(printCsf(csf).code).toBe(source);
  });

  it('mutates CSF4 meta objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ parameters: { componentSubtitle: 'Buttons' } });
      export const Basic = meta.story({});
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle'])
    ).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toMatch(
      /preview\.meta\(\{ parameters: \{ docs: \{\s+subtitle: 'Buttons'/
    );
  });

  it('renames fields in CSF4 story objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = meta.story({ parameters: {
        // Keep the configuration note.
        a11y: true,
      } });
    `);
    const [basic] = csf.objects({ meta: false, stories: true });

    expect(basic.rename(['parameters', 'a11y'], 'accessibility')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toMatch(/Keep the configuration note\.\s+accessibility: true/);
  });

  it('keeps a renamed field in its original position', () => {
    const csf = parse(`export default { first: true, oldName: true, last: true };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.rename(['oldName'], 'newName')).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(`export default { first: true, newName: true, last: true };`);
  });

  it('replaces a shorthand property value', () => {
    const csf = parse('const name = "old"; export default { name };');
    const [meta] = csf.objects({ stories: false });
    meta.set(['name'], t.stringLiteral('new'));

    const [updated] = parse(printCsf(csf).code).objects({ stories: false });
    expect(updated.get(['name'])).toMatchObject({ type: 'StringLiteral', value: 'new' });
  });

  it('preserves a shorthand property value when renaming its key', () => {
    const csf = parse(`const foo = true; export default { foo };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.rename(['foo'], 'bar')).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toContain('export default { bar: foo }');
  });

  it('preserves a shorthand property value when moving its key', () => {
    const csf = parse(`const foo = true; export default { foo };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['foo'], ['parameters', 'bar'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toMatch(/parameters: \{\s+bar: foo/);
  });

  it('removes fields from CSF4 extended story objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      const Base = meta.story({});
      export const Basic = Base.extend({ parameters: { a11y: true } });
    `);
    const [basic] = csf.objects({ meta: false, stories: true });

    expect(basic.remove(['parameters', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain('a11y');
  });

  it.each([
    ['meta without an argument', `const meta = preview.meta();`, { kind: 'meta' }],
    [
      'identifier-backed story argument',
      `const meta = preview.meta({});\nconst config = { args: {} };\nexport const Basic = meta.story(config);`,
      { kind: 'story', exportName: 'Basic', localName: 'Basic' },
    ],
    [
      'dynamic extend argument',
      `const meta = preview.meta({});\nconst Base = meta.story({});\nexport const Basic = Base.extend(makeConfig());`,
      { kind: 'story', exportName: 'Basic', localName: 'Basic' },
    ],
  ])('reports an unsupported CSF4 %s', (_kind, code, target) => {
    const csf = parse(`import preview from './preview';\n${code}`);

    csf.objects();

    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer', target })
    );
  });

  it('supports identifier-backed factory meta configuration', () => {
    const csf = parse(`
      import preview from './preview';
      const config = { title: 'Example' };
      const meta = preview.meta(config);
      export const Basic = meta.story({});
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.get(['title'])).toMatchObject({ type: 'StringLiteral', value: 'Example' });
  });

  it('rejects mutable identifier-backed factory meta configuration', () => {
    const csf = parse(`
      import preview from './preview';
      let config = { title: 'Example' };
      config = { title: 'Changed' };
      const meta = preview.meta(config);
      export const Basic = meta.story({});
    `);

    expect(csf.objects({ meta: true, stories: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer', target: { kind: 'meta' } })
    );
  });

  it('does not mutate unrelated factory-shaped receivers', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      const helper = { story: () => ({}) };
      export const Basic = helper.story({ parameters: { a11y: { element: '#root' } } });
    `);

    expect(csf.objects({ meta: false, stories: true })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('does not mutate factory receivers that have been reassigned', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      let Base = meta.story({});
      Base = helper;
      export const Basic = Base.extend({ parameters: { a11y: { element: '#root' } } });
    `);

    expect(csf.objects({ meta: false, stories: true })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('reports a standalone CSF4 meta call without changing the source', () => {
    const source = `import preview from './preview';\npreview.meta();`;
    const csf = parse(source);

    expect(csf.objects({ meta: true, stories: false })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer', target: { kind: 'meta' } })
    );
    expect(printCsf(csf).code).toBe(source);
  });

  it('ignores non-story factory-shaped exports', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = getMeta().story({ args: {} });
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toEqual([]);
  });
});
