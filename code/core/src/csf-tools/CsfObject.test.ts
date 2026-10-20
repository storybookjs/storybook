import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCsf, printCsf } from './CsfFile.ts';
import { loadConfig, printConfig } from './ConfigFile.ts';
import type { CsfExpression, CsfValue } from './CsfObject.ts';
import {
  type E as ESTree,
  parseExpression,
  parseModule,
  placeableTextOf,
  textOf,
} from './estree/ast.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['<T>(value: T) => value', '<number>size'])(
    'reads %s, which only a .ts file allows',
    (expression) => {
      const csf = loadCsf(`const size = 1;\nexport default { parameters: ${expression} };`, {
        fileName: 'Button.stories.ts',
        makeTitle: (title) => title ?? 'title',
      }).parse();
      const [meta] = csf.objects({ stories: false });

      expect(textOf(meta.get(['parameters'])!)).toBe(expression);
      expect(textOf(parseExpression(expression))).toBe(expression);
    }
  );

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

  it('tells a field from a missing and an unreadable one, and why', () => {
    const csf = parse(
      'export default {};\nexport const A = { args: { ...base }, parameters: { a: 1 } };'
    );
    const [story] = csf.objects({ meta: false });

    const value = story.inspect(['parameters', 'a']);
    expect(value.kind === 'value' && textOf(value.node)).toBe('1');
    expect(story.inspect(['missing'])).toEqual({ kind: 'missing' });
    expect(story.inspect(['args', 'size'])).toMatchObject({
      kind: 'unreadable',
      diagnostic: { code: 'spread-field', path: ['args', 'size'] },
    });
    expect(story.get(['args', 'size'])).toBeUndefined();
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('reads a constant that other code uses too, which an edit would not go through', () => {
    const csf = parse(`
      const label = 'x';
      const base = { size: 1 };
      export default {};
      export const A = { args: { label, base } };
      export const B = { args: { label, base } };
    `);
    const [story] = csf.objects({ meta: false });

    expect(story.getValue(['args'])).toEqual({ label: 'x', base: { size: 1 } });
    expect(story.getValue(['args', 'base', 'size'])).toBe(1);
    expect(textOf(story.get(['args', 'base', 'size'])!)).toBe('1');
    expect(story.inspect(['args', 'base', 'size']).kind).toBe('value');
    expect(csf.mutationDiagnostics).toEqual([]);

    expect(story.set(['args', 'base', 'size'], 2)).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-member' },
    });
  });

  it('reads a constant that contains itself as unresolved', () => {
    const csf = parse('const own = { own }; export default { parameters: { own } };');
    const [meta] = csf.objects({ stories: false });

    expect(meta.getValue(['parameters'])).toBeUndefined();
  });

  it('inspects every annotation of a CSF2 story, and the object itself as unreadable', () => {
    const csf = parse(
      'export default {};\nexport const A = Template.bind({});\nA.args = { size: "l" };\nA.parameters = { a: 1 };'
    );
    const [story] = csf.objects({ meta: false });
    const [meta] = csf.objects({ stories: false });

    expect(story.target).toEqual({ kind: 'story', exportName: 'A', localName: 'A' });
    expect(story.inspect(['parameters']).kind).toBe('value');
    expect(story.inspect(['args', 'size']).kind).toBe('value');
    expect(story.inspect([])).toMatchObject({
      kind: 'unreadable',
      diagnostic: { code: 'unsupported-member', path: [] },
    });
    expect(meta.inspect([])).toMatchObject({ kind: 'unreadable' });
    expect(story.get([])).toBeUndefined();
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
  ])('reads an unresolved value as undefined without executing %s', (expression) => {
    const probe = vi.fn();
    vi.stubGlobal('csfReadProbe', probe);
    const csf = parse(`export default { parameters: ${expression} };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.getValue(['parameters'])).toBeUndefined();
    expect(probe).not.toHaveBeenCalled();
    expect(csf.mutationDiagnostics).toEqual([]);
    expect(csf.changed).toBe(false);
  });

  it('rejects AST-like nodes that did not come from this API and prints plain data', () => {
    const csf = parse(`export default { title: 'X' };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['framework'], { type: 'StringLiteral', value: 'x' } as any)).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-value', message: expect.stringContaining('StringLiteral') },
    });
    expect(
      meta.set(['control'], { type: 'button', data: { type: 'Identifier', name: 'plainData' } })
    ).toMatchObject({ ok: false, diagnostic: { code: 'unsupported-value' } });
    expect(meta.set(['control'], { type: 'button', label: 'Save' })).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain(`control: { type: 'button', label: 'Save' }`);
  });

  it.each(['TextBlock', 'HeroBlock', 'ButtonElement'])(
    'prints data whose type %s only ends like a node type',
    (type) => {
      const csf = parse(`export default { title: 'X' };`);
      const [meta] = csf.objects({ stories: false });
      expect(meta.set(['data'], { type, text: 'x' })).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toContain(`data: { type: '${type}', text: 'x' }`);
    }
  );

  it.each(['toString', 'hasOwnProperty', 'constructor'])(
    'writes a config value whose type %s is an Object.prototype key as data',
    (type) => {
      const config = loadConfig(`export default { a: 'x' };`).parse();

      expect(config.set(['b'], { type })).toEqual({ ok: true, changed: true });
      expect(printConfig(config).code).toBe(`export default { a: 'x', b: { type: '${type}' } };`);
    }
  );

  it('places copied expressions so the surrounding code survives', () => {
    const csf = parse(`export default { a: (1, 2) };\nexport const B = { b: 0 };`);
    const [meta, story] = csf.objects();

    story.set(['b'], meta.get(['a'])!);
    expect(story.set(['c'], parseExpression('1 //x'))).toEqual({ ok: true, changed: true });

    const [, again] = parse(printCsf(csf).code).objects();
    expect(textOf(again.get(['b'])!)).toBe('1, 2');
    expect(again.getValue(['c'])).toBe(1);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('rejects a copy of an expression, whose source it cannot know', () => {
    const csf = parse(`export default { a: 1 };`);
    const [meta] = csf.objects({ stories: false });

    const copy = { ...meta.get(['a'])!, value: 5, raw: '5' } as CsfExpression;
    expect(meta.set(['b'], copy)).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: {
        code: 'unsupported-value',
        message:
          'Cannot set b to a Literal node that did not come from `get`, `transform` or `parseExpression`',
      },
    });
    expect(printCsf(csf).code).toBe(`export default { a: 1 };`);
  });

  it('rejects a transform result that did not come from this API, like set', () => {
    const source = 'export default { args: { n: 1 } };';
    const csf = parse(source);
    const [meta] = csf.objects({ stories: false });
    const statement = parseModule('2').program.body[0] as ESTree.ExpressionStatement;

    expect(meta.transform(['args', 'n'], () => statement.expression)).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code: 'unsupported-value', path: ['args', 'n'] },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it('wraps a sequence expression unless its own parentheses already enclose it', () => {
    const csf = parse(`export default { b: ((1), 2) };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['c'], meta.get(['b'])!)).toEqual({ ok: true, changed: true });
    expect(meta.set(['d'], parseExpression('((1), 2)'))).toEqual({ ok: true, changed: true });
    expect(meta.set(['e'], parseExpression('(1), (2)'))).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      `export default { b: ((1), 2), c: ((1), 2), d: ((1), 2), e: ((1), (2)) };`
    );
  });

  it('copies a parenthesized comma expression over itself and into new members', () => {
    const csf = parse(`export default { a: (x, y), b: 0 };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['a'], meta.get(['a'])!)).toEqual({ ok: true, changed: true });
    expect(meta.set(['b'], meta.get(['a'])!)).toEqual({ ok: true, changed: true });
    expect(meta.set(['c'], meta.get(['a'])!)).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(`export default { a: (x, y), b: (x, y), c: (x, y) };`);
  });

  it.each([
    { expression: '1 // x', output: 'export default { a: 1, // x\n b: 2 };' },
    { expression: 'x, y // x', output: 'export default { a: (x, y // x\n), b: 2 };' },
  ])('ends the line of $expression before the member after it', ({ expression, output }) => {
    const csf = parse('export default { a: 0, b: 2 };');
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['a'], parseExpression(expression))).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(output);
    expect(parse(output).objects({ stories: false })[0].getValue(['b'])).toBe(2);
  });

  it.each([
    { expression: '1 // note', output: 'export default {\n  a: 1, // note\n b: 2,\n};' },
    { expression: 'x, y', output: 'export default {\n  a: (x, y), b: 2,\n};' },
  ])('places a transformed $expression so the code after it survives', ({ expression, output }) => {
    const config = loadConfig('export default {\n  a: 0, b: 2,\n};').parse();

    expect(config.transform(['a'], () => parseExpression(expression))).toEqual({
      ok: true,
      changed: true,
    });
    expect(printConfig(config).code).toBe(output);
    expect(loadConfig(output).parse().getValue(['b'])).toBe(2);
  });

  it.each([
    {
      object: 'export default {\n  a: 1,\n};',
      path: ['b'],
      output: 'export default {\n  a: 1,\n  b: 2, // note\n};',
    },
    {
      object: 'export default {\n  a: 1\n};',
      path: ['b'],
      output: 'export default {\n  a: 1,\n  b: 2 // note\n};',
    },
    {
      object: 'export default {\n  a: 1,\n};',
      path: ['b', 'c'],
      output: 'export default {\n  a: 1,\n  b: {\n    c: 2, // note\n  },\n};',
    },
    {
      object: 'export default {\n  a: 1 };',
      path: ['b'],
      output: 'export default {\n  a: 1,\n  b: 2 // note\n };',
    },
    {
      object: 'export default {\n  a: 1,\n};',
      path: ['a'],
      output: 'export default {\n  a: 2, // note\n};',
    },
    {
      object: 'export default {\n  a: 1\n};',
      path: ['a'],
      output: 'export default {\n  a: 2 // note\n};',
    },
    {
      object: 'export default {\r\n  a: 1,\r\n};',
      path: ['b'],
      output: 'export default {\r\n  a: 1,\r\n  b: 2, // note\r\n};',
    },
  ])(
    'places the comma of $path before the line comment ending its value in $object',
    ({ object, path, output }) => {
      const config = loadConfig(object).parse();

      expect(config.set(path, parseExpression('2 // note'))).toEqual({ ok: true, changed: true });
      expect(printConfig(config).code).toBe(output);
      expect(loadConfig(output).parse().getValue(path)).toBe(2);
    }
  );

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
      if (value.type !== 'FunctionExpression') {
        throw new Error('Expected a function expression');
      }
      const source = textOf(value);
      return parseExpression(`${source.slice(0, source.lastIndexOf('}'))} return true; }`);
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
    expect(updated.get(destination)).toMatchObject({ type: 'Literal', value: 'mobile' });
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

  it('removes a CSF2 annotation that cleanup empties', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { viewport: { disable: true } };
      Basic.args = {};
    `);
    const [story] = csf.objects({ meta: false });

    expect(story.remove(['parameters', 'viewport', 'disable'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(story.remove(['args'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(`
      export default { title: 'Example' };
      export const Basic = () => null;
    `);
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
      elements: [{ type: 'Literal', value: 'original' }],
    });
  });

  it('does not expose mutable AST nodes through get, inspect or set', () => {
    const csf = parse(`export default { title: 'Original', args: { size: { value: 'small' } } };`);
    const [meta] = csf.objects({ meta: true, stories: false });
    const value = meta.get(['title']) as ESTree.StringLiteral;
    const inspected = meta.inspect(['args']);
    const replacement = parseExpression('"Replacement"');

    expect(() => {
      value.value = 'Mutated';
    }).toThrow(TypeError);
    expect(inspected.kind === 'value' && Object.isFrozen(inspected.node)).toBe(true);
    expect(
      inspected.kind === 'value' &&
        Object.isFrozen((inspected.node as ESTree.ObjectExpression).properties[0])
    ).toBe(true);
    meta.transform(['title'], (current) => {
      expect(Object.isFrozen(current)).toBe(true);
      return undefined;
    });
    expect(meta.set(['title'], replacement)).toEqual({ ok: true, changed: true });
    (replacement as { value: unknown }).value = 'Mutated replacement';

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
      type: 'Literal',
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

  it('uses logical paths for CSF2 argTypes assignments', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Playground = () => null;
      Playground.argTypes = { autoTruncateTokens: { defaultValue: false, control: 'boolean' } };
    `);
    const [argTypes] = csf.objects({ meta: false });

    expect(argTypes.get(['argTypes'])).toMatchObject({ type: 'ObjectExpression' });
    expect(argTypes.remove(['argTypes', 'autoTruncateTokens', 'defaultValue'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain("control: 'boolean'");
    expect(printCsf(csf).code).not.toContain('defaultValue');
  });

  it('resolves local values in CSF2 annotation roots', () => {
    const csf = parse(`
      export default { title: 'Example' };
      const shared = { defaultValue: false };
      export const Playground = () => null;
      Playground.argTypes = { autoTruncateTokens: shared };
    `);
    const [argTypes] = csf.objects({ meta: false });

    expect(argTypes.getValue(['argTypes'])).toEqual({
      autoTruncateTokens: { defaultValue: false },
    });
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('rejects repeated CSF2 annotations instead of exposing either object', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { first: true };
      Basic.parameters = { second: true };
      Basic.args = {};
    `);
    const [story] = csf.objects({ meta: false });

    expect(story.get(['parameters'])).toBeUndefined();
    expect(story.remove(['parameters', 'first']).ok).toBe(false);
    expect(story.set(['args', 'label'], 'Label').ok).toBe(true);
    expect(csf.mutationDiagnostics).toEqual([
      expect.objectContaining({ code: 'duplicate-field', path: ['parameters', 'first'] }),
    ]);
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

  it.each([
    ['spread', '...Primary'],
    ['computed key', '[field]: true'],
  ])('adds a field after an earlier %s, which it then overrides', (_kind, member) => {
    const csf = parse(`export default {};\nexport const A = { ${member}, args: { ${member} } };`);
    const [story] = csf.objects({ meta: false });

    expect(story.set(['play'], parseExpression('async () => {}'))).toEqual({
      ok: true,
      changed: true,
    });
    expect(story.set(['args', 'label'], 'x')).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      `export default {};\nexport const A = { ${member}, args: { ${member}, label: "x" }, play: async () => {} };`
    );
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it.each([
    [
      'a spread of a local object with the field',
      'const Base = { args: { b: 2 } };\nexport const A = { ...Base };',
      ['args', 'a'],
      "export const A = { ...Base, args: { ...Base.args, a: 'x' } };",
    ],
    [
      'a spread of a local object without the field',
      'const Base = { title: "B" };\nexport const A = { ...Base };',
      ['args', 'a'],
      "export const A = { ...Base, args: { a: 'x' } };",
    ],
    [
      'a spread of a local object that other code only names as a type',
      'const Base = { title: "B" };\ntype BaseType = typeof Base.title;\nexport const A = { ...Base };',
      ['args', 'a'],
      "export const A = { ...Base, args: { a: 'x' } };",
    ],
    [
      'a spread of a local object whose play another story calls',
      'const Base = { args: {}, play: async () => {} };\nexport const A = { ...Base, play: async (c) => { await Base.play(c); await Base.play?.(c); } };',
      ['parameters', 'a'],
      "export const A = { ...Base, play: async (c) => { await Base.play(c); await Base.play?.(c); }, parameters: { a: 'x' } };",
    ],
    [
      'a spread of a local object whose args a render spreads into JSX',
      'const Base = { args: {} };\nexport const A = { ...Base, render: (args) => <C {...Base.args} /> };',
      ['parameters', 'a'],
      "export const A = { ...Base, render: (args) => <C {...Base.args} />, parameters: { a: 'x' } };",
    ],
    [
      'a spread of a local object a member of which is already spread',
      'const Base = { title: "B" };\nexport const A = { ...Base, args: { ...Base.args } };',
      ['parameters', 'a'],
      "export const A = { ...Base, args: { ...Base.args }, parameters: { a: 'x' } };",
    ],
    [
      'a spread of a local object whose nested object lacks the field',
      'const Base = { parameters: {} };\nexport const A = { ...Base };',
      ['parameters', 'docs', 'a'],
      "export const A = { ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters.docs, a: 'x' } } };",
    ],
    [
      'a spread of a local object, two parents deep',
      'const Base = { parameters: { docs: { y: 1 } } };\nexport const A = { ...Base };',
      ['parameters', 'docs', 'a'],
      "export const A = { ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters.docs, a: 'x' } } };",
    ],
    [
      'a spread of an import, two parents deep',
      "import { Base } from './Base.stories';\nexport const A = { ...Base };",
      ['parameters', 'my-addon', 'a'],
      "export const A = { ...Base, parameters: { ...Base.parameters, 'my-addon': { ...Base.parameters?.['my-addon'], a: 'x' } } };",
    ],
    [
      'several spreads, of which the last is a local object known to have the field',
      "import { One } from './stories';\nconst Two = { args: {} };\nexport const A = { ...One, ...Two };",
      ['args', 'a'],
      "export const A = { ...One, ...Two, args: { ...Two.args, a: 'x' } };",
    ],
    [
      'a spread of a member chain',
      "import * as stories from './Base.stories';\nexport const A = { ...stories.Base };",
      ['args', 'a'],
      "export const A = { ...stories.Base, args: { ...stories.Base.args, a: 'x' } };",
    ],
    [
      'a spread with a type assertion',
      "import { Base } from './Base.stories';\nexport const A = { ...(Base as Story) };",
      ['args', 'a'],
      "export const A = { ...(Base as Story), args: { ...(Base as Story).args, a: 'x' } };",
    ],
    [
      'a spread inside a nested object',
      "import { base } from './base';\nexport const A = { args: { ...base } };",
      ['args', 'nested', 'a'],
      "export const A = { args: { ...base, nested: { ...base.nested, a: 'x' } } };",
    ],
  ])(
    'creates a missing parent after %s, carrying the spread member forward',
    (_case, code, path, line) => {
      const csf = parse(`export default { title: 'X' };\n${code}`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(path, 'x')).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code.split('\n').at(-1)).toBe(line);
      expect(csf.mutationDiagnostics).toEqual([]);
    }
  );

  it.each([
    ['two imports', "import { One, Two } from './stories';\nexport const A = { ...One, ...Two };"],
    [
      'a local object with the field, then an import',
      "import { Two } from './stories';\nconst One = { args: { stale: 1 } };\nexport const A = { ...One, ...Two };",
    ],
  ])('refuses a missing parent after %s, either of which may provide it', (_case, code) => {
    const source = `export default { title: 'X' };\n${code}`;
    const csf = parse(source);
    const [story] = csf.objects({ meta: false });

    expect(story.set(['args', 'a'], 'x')).toMatchObject({
      ok: false,
      diagnostic: { code: 'spread-field', path: ['args', 'a'] },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it.each([
    ['an assignment', 'const Base = { render: () => null };\nBase.args = { x: 1 };'],
    [
      'Object.assign',
      'const Base = { render: () => null };\nObject.assign(Base, { args: { x: 1 } });',
    ],
    [
      'an assignment to an exported base',
      'export const Base = { render: () => null };\nBase.args = { x: 1 };',
    ],
    [
      'a destructuring assignment',
      'const Base = { render: () => null };\n({ args: Base.args } = source);',
    ],
    ['a call it is passed to', 'const Base = { render: () => null };\nmutate(Base);'],
    ['an alias', 'const Base = { render: () => null };\nconst Alias = Base;'],
  ])(
    'reads through a spread whose base gets members from %s after its declaration',
    (_case, base) => {
      const csf = parse(`export default { title: 'X' };\n${base}\nexport const A = { ...Base };`);
      const story = csf
        .objects({ meta: false })
        .find(({ target }) => target.kind === 'story' && target.exportName === 'A')!;

      expect(story.set(['args', 'a'], 'x')).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code.split('\n').at(-1)).toBe(
        "export const A = { ...Base, args: { ...Base.args, a: 'x' } };"
      );
    }
  );

  it.each([
    [
      'a story',
      'const Base = { args: { a: 1 } };\nexport const B = { ...Base };\nB.args.b = { z: 1 };',
      ['args', 'b', 'w'],
      "export const A = { ...Base, args: { ...Base.args, b: { ...Base.args.b, w: 'x' } } };",
    ],
    [
      'a local constant',
      'const Base = { parameters: {} };\nconst Other = { ...Base };\nOther.parameters.docs = { extra: 1 };',
      ['parameters', 'docs', 'a'],
      "export const A = { ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters.docs, a: 'x' } } };",
    ],
  ])(
    'reads through a nested object of a spread base that a copy of it in %s shares',
    (_case, base, path, line) => {
      const csf = parse(`export default { title: 'X' };\n${base}\nexport const A = { ...Base };`);
      const story = csf
        .objects({ meta: false })
        .find(({ target }) => target.kind === 'story' && target.exportName === 'A')!;

      expect(story.set(path, 'x')).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code.split('\n').at(-1)).toBe(line);
    }
  );

  it('lays a created parent after a spread out on lines for a multi-line value', () => {
    const csf = parse(
      "export default { title: 'X' };\nconst Base = { args: {} };\nexport const A = {\n  ...Base,\n};"
    );
    const [story] = csf.objects({ meta: false });

    expect(story.set(['args', 'onClick'], parseExpression('() => {\n  x();\n}'))).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain(
      'export const A = {\n  ...Base,\n  args: {\n    ...Base.args,\n    onClick: () => {\n      x();\n    },\n  },\n};'
    );
  });

  it.each([
    [
      'creating a parent after a spread of a call',
      '{ ...make() }',
      ['args', 'label'],
      'spread-field',
    ],
    ['creating a parent after a computed key', '{ [key]: {} }', ['args', 'label'], 'dynamic-key'],
    [
      'changing a field a later spread could shadow',
      "{ label: 'a', ...base }",
      ['label'],
      'spread-field',
    ],
    [
      'setting into a field a later spread could shadow',
      '{ args: {}, ...base }',
      ['args', 'a'],
      'spread-field',
    ],
  ])('rejects %s', (_case, object, path, code) => {
    const source = `export default {};\nexport const A = ${object};`;
    const csf = parse(source);
    const [story] = csf.objects({ meta: false });

    expect(story.set(path, 'x')).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it('rejects moving to a field a spread could provide', () => {
    const source = `export default {};\nexport const A = { label: 'a', args: { ...base } };`;
    const csf = parse(source);
    const [story] = csf.objects({ meta: false });

    expect(story.move(['label'], ['args', 'label'])).toMatchObject({
      ok: false,
      diagnostic: { code: 'spread-field' },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it('indents a replaced value like the member, keeping the comment above it', () => {
    const csf = parse(
      'export default {};\nexport const A = {\n  // Records the steps.\n  play: async () => {},\n};'
    );
    const [story] = csf.objects({ meta: false });

    expect(story.set(['play'], parseExpression('async () => {\n  await x();\n}'))).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toBe(
      'export default {};\nexport const A = {\n  // Records the steps.\n  play: async () => {\n    await x();\n  },\n};'
    );
  });

  it('indents a value from get like the place it is set', () => {
    const source = [
      'export default {};',
      'export const A = {',
      '  play: async () => {',
      '    await step(`one',
      '  two`);',
      '  },',
      '};',
      'export const B = { args: {} };',
    ].join('\n');
    const csf = parse(source);
    const [a, b] = csf.objects({ meta: false });

    expect(a.set(['play'], a.get(['play'])!)).toEqual({ ok: true, changed: true });
    expect(a.transform(['play'], (value) => parseExpression(textOf(value)))).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toBe(source);

    expect(b.set(['args', 'play'], a.get(['play'])!)).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toContain(
      'export const B = { args: {\n  play: async () => {\n    await step(`one\n  two`);\n  },\n} };'
    );
  });

  it('indents a value from the line it starts on, below its key', () => {
    const csf = parse(
      'export default {};\nexport const A = {\n  play:\n    async () => {\n      x();\n    },\n};\nexport const B = {\n  play: 1,\n};'
    );
    const [a, b] = csf.objects({ meta: false });

    expect(b.set(['play'], a.get(['play'])!)).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toContain(
      'export const B = {\n  play: async () => {\n    x();\n  },\n};'
    );
  });

  it('writes expressions nested in a plain value as their source', () => {
    const csf = parse("export default {};\nexport const A = {\n  name: 'A',\n};");
    const [story] = csf.objects({ meta: false });

    expect(
      story.set(['args'], {
        onClick: parseExpression('() => {}'),
        items: [parseExpression('first'), { label: 'x' }],
      })
    ).toEqual({ ok: true, changed: true });
    expect(
      story.set(['play'], {
        run: parseExpression('async () => {\n  await x();\n}'),
        steps: [parseExpression('() => {\n  a();\n}'), 'b'],
      })
    ).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      [
        'export default {};',
        'export const A = {',
        "  name: 'A',",
        "  args: { onClick: () => {}, items: [first, { label: 'x' }] },",
        '  play: {',
        '    run: async () => {',
        '      await x();',
        '    },',
        '    steps: [',
        '      () => {',
        '        a();',
        '      },',
        "      'b',",
        '    ],',
        '  },',
        '};',
      ].join('\n')
    );
  });

  it('rejects a node without a parse nested in a value', () => {
    const source = 'export default {};\nexport const A = {};';
    const csf = parse(source);
    const [story] = csf.objects({ meta: false });
    const statement = parseModule('() => {}').program.body[0] as ESTree.ExpressionStatement;

    expect(story.set(['args'], { onClick: statement.expression })).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code: 'unsupported-value' },
    });
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
        values.type === 'ArrayExpression' && values.elements[0]
          ? parseExpression(`{\n  gray: ${textOf(values.elements[0])}\n}`)
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

  it.each([
    {
      reason: 'into a value that is not an object',
      code: 'unsupported-member',
      source: `export default { parameters: { docs: true, subtitle: 'New' } };`,
    },
    {
      reason: 'past a spread of a call',
      code: 'spread-field',
      source: `export default { parameters: { ...getBase(), subtitle: 'New' } };`,
    },
    {
      reason: 'past a computed key',
      code: 'dynamic-key',
      source: `export default { parameters: { [key]: {}, subtitle: 'New' } };`,
    },
  ])('leaves the file byte-identical when a move $reason is refused', ({ source, code }) => {
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['parameters', 'subtitle'], ['parameters', 'docs', 'subtitle'])).toMatchObject(
      { ok: false, changed: false, diagnostic: { code } }
    );
    expect(csf.changed).toBe(false);
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

    expect(
      meta.set(['parameters', '__proto__', 'polluted'], parseExpression('true'))
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-member' },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it('addresses numeric literal keys by their static string value', () => {
    const csf = parse(`export default { parameters: { 1: 'one' } };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', '1'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain(`1: 'one'`);
  });

  it('reads and writes a non-ASCII key of a story as an identifier key', () => {
    const csf = parse(`export default {};\nexport const A = { args: { ñame: 'a' } };`);
    const [story] = csf.objects({ meta: false });

    expect(story.getValue(['args', 'ñame'])).toBe('a');
    expect(story.set(['args', 'ñandú'], 'b')).toEqual({ ok: true, changed: true });
    expect(story.set(['parameters'], { ñame: 1, 'a-b': 2 })).toEqual({ ok: true, changed: true });
    expect(textOf(story.get(['args'])!)).toBe(`{ ñame: 'a', ñandú: 'b' }`);
    expect(printCsf(csf).code).toBe(
      `export default {};\nexport const A = { args: { ñame: 'a', ñandú: 'b' }, parameters: { ñame: 1, 'a-b': 2 } };`
    );
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
    meta.set(['name'], parseExpression("'new'"));

    const [updated] = parse(printCsf(csf).code).objects({ stories: false });
    expect(updated.get(['name'])).toMatchObject({ type: 'Literal', value: 'new' });
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

    expect(meta.get(['title'])).toMatchObject({ type: 'Literal', value: 'Example' });
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

  describe('an edit the CSF indexer rejects', () => {
    const load = (code: string) =>
      loadCsf(code, { fileName: 'B.stories.ts', makeTitle: (title) => title ?? 'B' }).parse();
    const source = "export default { title: 'B', tags: ['docs'] };\nexport const A = {};\n";

    it('refuses the edit and leaves the file as it was', () => {
      const csf = load(source);
      const [meta] = csf.objects({ stories: false });

      const result = meta.transform(['tags'], (value) =>
        parseExpression(`[...${placeableTextOf(value)}, 'autodocs']`)
      );

      expect(result).toEqual({
        ok: false,
        changed: false,
        diagnostic: expect.objectContaining({
          code: 'invalid-csf',
          path: ['tags'],
          message: expect.stringContaining('CSF: Expected tag to be string literal'),
        }),
      });
      expect(printCsf(csf).code).toBe(source);
      expect(csf.changed).toBe(false);
      expect(meta.changed).toBe(false);
      expect(csf.meta?.tags).toEqual(['docs']);
      expect(csf.stories).toHaveLength(1);
      expect(csf.objects()).toHaveLength(2);
      expect(csf.mutationDiagnostics).toEqual([
        expect.objectContaining({ code: 'invalid-csf', target: { kind: 'meta' } }),
      ]);
    });

    it('rolls back a move whose insertion the indexer rejects before its source is removed', () => {
      const csf = load(
        "export default { title: 'B', parameters: { a: 1 } };\nexport const A = {};\n"
      );
      const [meta] = csf.objects({ stories: false });

      expect(meta.move(['parameters'], ['tags'])).toMatchObject({
        ok: false,
        changed: false,
        diagnostic: { code: 'invalid-csf' },
      });
      expect(printCsf(csf).code).toBe(
        "export default { title: 'B', parameters: { a: 1 } };\nexport const A = {};\n"
      );
      expect(csf.changed).toBe(false);
    });

    it('throws for code that does not parse, leaving earlier edits and the index as they were', () => {
      const csf = load("export default { title: 'B' };\nexport const A = {};\n");
      const [meta] = csf.objects({ stories: false });
      csf.editor.edits.appendLeft(0, '(');

      expect(() => meta.set(['tags'], ['docs'])).toThrow(/B\.stories\.ts$/);
      expect(csf.editor.edits.toString()).toBe(
        "(export default { title: 'B' };\nexport const A = {};\n"
      );
      expect(csf.editor._committed).toEqual([]);
      expect(csf.meta?.title).toBe('B');
      expect(csf.changed).toBe(false);
      expect(csf.mutationDiagnostics).toEqual([]);
    });

    it.each([
      { path: ['title'], expression: '`B`', error: 'CSF: unexpected dynamic title' },
      { path: ['includeStories'], expression: 'fn()', error: 'Unknown include/exclude' },
    ])(
      'refuses setting $path to $expression, keeping the index readable',
      ({ path, expression, error }) => {
        const csf = load("export default { title: 'B' };\nexport const A = {};\n");
        const [meta] = csf.objects({ stories: false });

        expect(meta.set(path, parseExpression(expression))).toMatchObject({
          ok: false,
          changed: false,
          diagnostic: { code: 'invalid-csf', message: expect.stringContaining(error) },
        });
        expect(printCsf(csf).code).toBe("export default { title: 'B' };\nexport const A = {};\n");
        expect(csf.meta?.title).toBe('B');
        expect(csf.indexInputs).toHaveLength(1);
        expect(csf.objects()).toHaveLength(2);
      }
    );
  });

  describe('transaction', () => {
    const source = `export default { title: 'B' };
export const A = {
  beforeEach: setup,
  ...shared,
  parameters: { msw: { handlers: [] }, layout: 'centered' },
};
`;

    it('rolls every edit back when a mutation in it is refused', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      const kept = csf.transaction(() => {
        expect(story.remove(['parameters', 'msw'])).toEqual({ ok: true, changed: true });
        expect(story.set(['beforeEach'], parseExpression('mockHandlers')).ok).toBe(false);
      });

      expect(kept).toBe(false);
      expect(printCsf(csf).code).toBe(source);
      expect(story.getValue(['parameters', 'layout'])).toBe('centered');
      expect(story.get(['parameters', 'msw'])).toBeDefined();
      expect(csf.changed).toBe(false);
      expect(story.changed).toBe(false);
      expect(csf.mutationDiagnostics).toEqual([
        expect.objectContaining({ code: 'spread-field', path: ['beforeEach'] }),
      ]);
    });

    it('keeps the edits when every mutation in it succeeds', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      const kept = csf.transaction(() => {
        story.remove(['parameters', 'msw']);
        story.set(['parameters', 'layout'], 'fullscreen');
      });

      expect(kept).toBe(true);
      expect(printCsf(csf).code).toContain("parameters: { layout: 'fullscreen' },");
      expect(csf.changed).toBe(true);
      expect(story.changed).toBe(true);
    });

    it('rolls back when the function returns false or throws, and rethrows', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      expect(csf.transaction(() => (story.remove(['parameters']), false))).toBe(false);
      expect(() =>
        csf.transaction(() => {
          story.remove(['parameters']);
          throw new Error('codemod bug');
        })
      ).toThrow('codemod bug');

      expect(printCsf(csf).code).toBe(source);
      expect(csf.stories.map(({ name }) => name)).toEqual(['A']);
    });

    it('rolls back an edit the CSF indexer rejects, so the file indexes again', () => {
      const csf = parse("export default { title: 'B', tags: ['docs'] };\nexport const A = {};\n");
      const [meta] = csf.objects({ stories: false });

      const kept = csf.transaction(() => {
        meta.set(['tags'], parseExpression("[...['docs'], 'autodocs']"));
      });

      expect(kept).toBe(false);
      expect(csf.meta?.tags).toEqual(['docs']);
      expect(meta.set(['tags'], ['docs', 'autodocs'])).toEqual({ ok: true, changed: true });
    });

    it('rolls back an inner transaction on its own', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      const kept = csf.transaction(() => {
        story.remove(['parameters', 'msw']);
        expect(csf.transaction(() => story.set(['beforeEach'], 'x').ok)).toBe(false);
      });

      expect(kept).toBe(true);
      expect(printCsf(csf).code).toContain("parameters: { layout: 'centered' },");
      expect(printCsf(csf).code).toContain('beforeEach: setup,');
    });

    it('rolls back a kept inner transaction with the outer one', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      const kept = csf.transaction(() => {
        expect(csf.transaction(() => story.remove(['parameters', 'msw']).ok)).toBe(true);
        story.set(['beforeEach'], 'x');
      });

      expect(kept).toBe(false);
      expect(printCsf(csf).code).toBe(source);
      expect(story.changed).toBe(false);
    });

    it('rolls back what a function returning a promise did before throwing', () => {
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });

      // @ts-expect-error A transaction runs synchronously.
      expect(() => csf.transaction(async () => story.remove(['parameters']))).toThrow('promise');
      expect(printCsf(csf).code).toBe(source);
    });

    it('rolls back when an array helper is refused', () => {
      const code = "export default { layout: 'centered', tags: 'a' };";
      const config = loadConfig(code).parse();

      const kept = config.transaction(() => {
        config.remove(['layout']);
        config.appendValueToArray(['tags'], 'b');
      });

      expect(kept).toBe(false);
      expect(printConfig(config).code).toBe(code);
    });

    it('rolls back config edits, named exports included', () => {
      const code =
        "export const parameters = { layout: 'centered' };\nexport const tags = ['a'];\n";
      const config = loadConfig(code).parse();

      const kept = config.transaction(() => {
        config.remove(['parameters', 'layout']);
        config.set(['tags', 'nested'], 1);
      });

      expect(kept).toBe(false);
      expect(printConfig(config).code).toBe(code);
      expect(config.changed).toBe(false);
      expect(config.getValue(['parameters'])).toEqual({ layout: 'centered' });
    });
  });
});

describe('CsfObject.node', () => {
  it('returns the object literal of the current parse, found again after an edit', () => {
    const csf = parse(`export default { title: 'A' };\nexport const Primary = { args: {} };`);
    const [meta, story] = csf.objects();
    const before = story.node!;

    expect(textOf(before)).toBe('{ args: {} }');
    expect(meta.node).toBe(csf._metaNode);

    story.set(['args', 'disabled'], true);

    expect(story.node).not.toBe(before);
    expect(textOf(story.node!)).toBe('{ args: { disabled: true } }');
  });

  it('returns the object of a story with assignments, nothing without one, and the argument of a factory', () => {
    const csf = parse(
      `export default {};\nexport const Primary = () => null;\nPrimary.parameters = { a: 1 };\nexport const Secondary = { args: {} };\nSecondary.parameters = { a: 1 };`
    );
    const [primary, secondary] = csf.objects({ meta: false });

    expect(primary.node).toBeUndefined();
    expect(textOf(secondary.node!)).toBe('{ args: {} }');

    const config = loadConfig(`export default definePreview({ tags: [] });`).parse();
    expect(textOf(config.node!)).toBe('{ tags: [] }');
  });

  it('returns undefined for a config made of named exports, without a diagnostic', () => {
    const config = loadConfig(`export const tags = [];`).parse();

    expect(config.node).toBeUndefined();
    expect(config.mutationDiagnostics).toEqual([]);
  });
});
