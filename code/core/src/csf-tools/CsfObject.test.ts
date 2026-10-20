import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCsf, printCsf } from './CsfFile.ts';
import type { ConfigFile } from './ConfigFile.ts';
import { loadConfig, printConfig } from './ConfigFile.ts';
import {
  type CsfExpression,
  type CsfInspection,
  type CsfMutationDiagnosticCode,
  type CsfMutationResult,
  type CsfObject,
  type CsfValue,
  createCsfObject,
  printCsfPath,
} from './CsfObject.ts';
import type { ObjectRoot } from './ObjectRoot.ts';
import { literalRoot } from './ObjectRoot.ts';
import { SourceEditor, appendMembers } from './estree/editor.ts';
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

  it('prints an object shaped like a node as data when no parser made it', () => {
    const csf = parse(`export default { title: 'X' };`);
    const [meta] = csf.objects({ stories: false });

    expect(meta.set(['framework'], { type: 'StringLiteral', value: 'x' })).toEqual({
      ok: true,
      changed: true,
    });
    expect(
      meta.set(['control'], { type: 'button', data: { type: 'Identifier', name: 'plainData' } })
    ).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      `export default { title: 'X', framework: { type: 'StringLiteral', value: 'x' }, control: { type: 'button', data: { type: 'Identifier', name: 'plainData' } } };`
    );
  });

  it.each([
    ['offsets', { start: 0, end: 3 }],
    ['a loc', { loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } } }],
    ['a range', { range: [0, 3] }],
  ])('rejects a node of another parser with %s but not the parse tag', (_kind, position) => {
    const csf = parse(`export default { title: 'X' };`);
    const [meta] = csf.objects({ stories: false });
    const node = { type: 'StringLiteral', value: 'x', ...position };

    expect(meta.set(['framework'], node)).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-value', message: expect.stringContaining('StringLiteral') },
    });
    expect(printCsf(csf).code).toBe(`export default { title: 'X' };`);
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
          'Cannot set b to a Literal node that did not come from `get`, `transform`, `parseExpression` or `parseModule`',
      },
    });
    expect(printCsf(csf).code).toBe(`export default { a: 1 };`);
  });

  it('sets an expression of a parseModule tree as written', () => {
    const csf = parse(`export default { a: 1 };`);
    const [meta] = csf.objects({ stories: false });
    const { program } = parseModule(`const handlers = [\n  http.get('/a', resolve),\n];`);
    const [declarator] = (program.body[0] as ESTree.VariableDeclaration).declarations;

    expect(meta.set(['b'], declarator.init!)).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      ['export default {', '  a: 1,', '  b: [', "    http.get('/a', resolve),", '  ]', '};'].join(
        '\n'
      )
    );
  });

  it('rejects a transform result that did not come from this API, like set', () => {
    const source = 'export default { args: { n: 1 } };';
    const csf = parse(source);
    const [meta] = csf.objects({ stories: false });

    expect(meta.transform(['args', 'n'], () => ({ ...parseExpression('2') }))).toMatchObject({
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

  describe('spreads', () => {
    const storyEdits = {
      "set(['args'], { a: 1 })": (story) => story.set(['args'], { a: 1 }),
      "set(['args', 'a'], 1)": (story) => story.set(['args', 'a'], 1),
      "set(['args', 'a'], 2)": (story) => story.set(['args', 'a'], 2),
      "set(['args', 'b', 'a'], 1)": (story) => story.set(['args', 'b', 'a'], 1),
      "set(['parameters', 'docs', 'a'], 1)": (story) => story.set(['parameters', 'docs', 'a'], 1),
      "set(['label'], 'b')": (story) => story.set(['label'], 'b'),
      "remove(['label'])": (story) => story.remove(['label']),
      "rename(['label'], 'name')": (story) => story.rename(['label'], 'name'),
      "move(['label'], ['args', 'label'])": (story) => story.move(['label'], ['args', 'label']),
      "group(['args'], ['a', 'b'])": (story) => story.group(['args'], ['a', 'b']),
      "inspect(['label'])": (story) => story.inspect(['label']),
      "inspect(['args'])": (story) => story.inspect(['args']),
    } satisfies Record<string, (story: CsfObject) => CsfMutationResult | CsfInspection>;
    const configEdits = {
      "append(['addons'], 'x')": (config) => config.append(['addons'], 'x'),
    } satisfies Record<string, (config: ConfigFile) => CsfMutationResult>;
    const isConfigEdit = (edit: string): edit is keyof typeof configEdits => edit in configEdits;
    type Row = {
      before: string;
      object: string;
      edit: keyof typeof storyEdits | keyof typeof configEdits;
      result:
        | { writes: string }
        | { refused: CsfMutationDiagnosticCode }
        | { inspects: 'value' }
        | { inspects: 'unreadable'; code: CsfMutationDiagnosticCode };
    };
    const rows: Row[] = [
      {
        before: '',
        object: '{ ...make(), [key]: 0 }',
        edit: "set(['args'], { a: 1 })",
        result: { writes: '{ ...make(), [key]: 0, args: { a: 1 } }' },
      },
      {
        before: "import { base } from './base';",
        object: '{ args: { ...base } }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ args: { ...base, a: 1 } }' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, a: 1 } }' },
      },
      {
        before: "import * as stories from './base';",
        object: '{ ...stories.Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...stories.Base, args: { ...stories.Base.args, a: 1 } }' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ ...(Base as Story) }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...(Base as Story), args: { ...(Base as Story).args, a: 1 } }' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ ...Base }',
        edit: "set(['parameters', 'docs', 'a'], 1)",
        result: {
          writes:
            '{ ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters?.docs, a: 1 } } }',
        },
      },
      {
        before: "import { base } from './base';",
        object: '{ args: { ...base } }',
        edit: "set(['args', 'b', 'a'], 1)",
        result: { writes: '{ args: { ...base, b: { ...base.b, a: 1 } } }' },
      },
      {
        before: "import { One, Two } from './base';",
        object: '{ ...One, ...Two }',
        edit: "set(['args', 'a'], 1)",
        result: { refused: 'spread-field' },
      },
      {
        before: '',
        object: '{ ...make() }',
        edit: "set(['args', 'a'], 1)",
        result: { refused: 'spread-field' },
      },
      {
        before: '',
        object: '{ [key]: 0 }',
        edit: "set(['args', 'a'], 1)",
        result: { refused: 'dynamic-key' },
      },
      {
        before: 'const Base = { args: { b: 2 } };',
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, a: 1 } }' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { a: 1 } }' },
      },
      {
        before: 'const Base = { parameters: {} };',
        object: '{ ...Base }',
        edit: "set(['parameters', 'docs', 'a'], 1)",
        result: {
          writes:
            '{ ...Base, parameters: { ...Base.parameters, docs: { ...Base.parameters.docs, a: 1 } } }',
        },
      },
      {
        before: "import { One } from './base'; const Two = { args: {} };",
        object: '{ ...One, ...Two }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...One, ...Two, args: { ...Two.args, a: 1 } }' },
      },
      {
        before: "import { One } from './base'; const Two = { title: 'B' };",
        object: '{ ...One, ...Two }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...One, ...Two, args: { ...One.args, a: 1 } }' },
      },
      {
        before: 'const Base = { play: async () => {} };',
        object: '{ ...Base, play: async (c) => { await Base.play(c); } }',
        edit: "set(['args', 'a'], 1)",
        result: {
          writes: '{ ...Base, play: async (c) => { await Base.play(c); }, args: { a: 1 } }',
        },
      },
      {
        before: "const Base = { title: 'B' }; Base.args = { x: 1 };",
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, a: 1 } }' },
      },
      {
        before: "const Base = { title: 'B' }; mutate(Base);",
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, a: 1 } }' },
      },
      {
        before: 'const Base = { setup() { this.args = { x: 1 }; } }; Base.setup();',
        object: '{ ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, a: 1 } }' },
      },
      {
        before: 'const Base = { async play() {} };',
        object: '{ ...Base, play: async (c) => { await Base.play(c); } }',
        edit: "set(['args', 'a'], 1)",
        result: {
          writes:
            '{ ...Base, play: async (c) => { await Base.play(c); }, args: { ...Base.args, a: 1 } }',
        },
      },
      {
        before:
          'const Base = { *[Symbol.iterator]() { this.args = undefined; }, args: {} }; [...Base];',
        object: '{ ...Base }',
        edit: "set(['args', 'b', 'a'], 1)",
        result: { writes: '{ ...Base, args: { ...Base.args, b: { ...Base.args?.b, a: 1 } } }' },
      },
      {
        before: "import shared from './shared';",
        object: '{ ...shared }',
        edit: "append(['addons'], 'x')",
        result: { writes: "{ ...shared, addons: [...(shared.addons ?? []), 'x'] }" },
      },
      {
        before: "import { Base } from './base';",
        object: "{ ...Base, label: 'a' }",
        edit: "set(['label'], 'b')",
        result: { writes: "{ ...Base, label: 'b' }" },
      },
      {
        before: "import { Base } from './base';",
        object: "{ label: 'a', ...Base }",
        edit: "set(['label'], 'b')",
        result: { refused: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ args: {}, ...Base }',
        edit: "set(['args', 'a'], 1)",
        result: { refused: 'spread-field' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: '{ args: { a: 1 }, ...Base }',
        edit: "set(['args', 'a'], 2)",
        result: { writes: '{ args: { a: 2 }, ...Base }' },
      },
      {
        before: 'const Base = { args: {} };',
        object: '{ args: { a: 1 }, ...Base }',
        edit: "set(['args', 'a'], 2)",
        result: { refused: 'spread-field' },
      },
      {
        before: "const Base = { title: 'B' }; Base.args = {};",
        object: '{ args: { a: 1 }, ...Base }',
        edit: "set(['args', 'a'], 2)",
        result: { refused: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: "{ ...Base, label: 'a' }",
        edit: "remove(['label'])",
        result: { refused: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: "{ ...Base, label: 'a' }",
        edit: "rename(['label'], 'name')",
        result: { refused: 'spread-field' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: "{ label: 'a', ...Base }",
        edit: "remove(['label'])",
        result: { writes: '{ ...Base }' },
      },
      {
        before: "const Base = { label: 'b' };",
        object: "{ label: 'a', ...Base }",
        edit: "remove(['label'])",
        result: { refused: 'spread-field' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: "{ ...Base, label: 'a' }",
        edit: "remove(['label'])",
        result: { writes: '{ ...Base }' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: "{ ...Base, label: 'a' }",
        edit: "rename(['label'], 'name')",
        result: { writes: "{ ...Base, name: 'a' }" },
      },
      {
        before: "import { base } from './base';",
        object: "{ label: 'a', args: { ...base } }",
        edit: "move(['label'], ['args', 'label'])",
        result: { refused: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ ...Base, a: 1, b: 2 }',
        edit: "group(['args'], ['a', 'b'])",
        result: { refused: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: "{ ...Base, label: 'a' }",
        edit: "inspect(['label'])",
        result: { inspects: 'value' },
      },
      {
        before: "import { Base } from './base';",
        object: "{ label: 'a', ...Base }",
        edit: "inspect(['label'])",
        result: { inspects: 'unreadable', code: 'spread-field' },
      },
      {
        before: "import { Base } from './base';",
        object: '{ ...Base }',
        edit: "inspect(['args'])",
        result: { inspects: 'unreadable', code: 'spread-field' },
      },
      {
        before: "const Base = { title: 'B' };",
        object: '{ args: { a: 1 }, ...Base }',
        edit: "inspect(['args'])",
        result: { inspects: 'value' },
      },
    ];
    const cells = ({ before, object, edit, result }: Row) => [
      before && `\`${before}\``,
      `\`${object}\``,
      `\`${edit}\``,
      'writes' in result
        ? `\`${result.writes}\``
        : 'refused' in result
          ? `refused, \`${result.refused}\``
          : 'code' in result
            ? `\`unreadable\`, \`${result.code}\``
            : '`value`',
    ];
    const apply = ({ before, object, edit }: Row) => {
      if (isConfigEdit(edit)) {
        const source = `${before}\nexport default ${object};`;
        const config = loadConfig(source).parse();
        const done = configEdits[edit](config);
        return { source, declaration: 'export default', done, printed: printConfig(config).code };
      }
      const source = `export default {};\n${before}\nexport const A = ${object};`;
      const csf = parse(source);
      const [story] = csf.objects({ meta: false });
      const done = storyEdits[edit](story);
      return { source, declaration: 'export const A =', done, printed: printCsf(csf).code };
    };

    it('are the rows of the table in the README', () => {
      const lines = readFileSync(new URL('README.md', import.meta.url), 'utf8').split('\n');
      const header = lines.findIndex((line) => /^\|\s*Declared before\s*\|/.test(line));
      const table = lines.slice(header + 2, lines.indexOf('', header));

      expect(
        table.map((line) =>
          line
            .split(/(?<!\\)\|/)
            .slice(1, -1)
            .map((text) => text.trim().replaceAll('\\|', '|'))
        )
      ).toEqual(rows.map(cells));
    });

    it.each(rows.map((row) => [cells(row).filter(Boolean).join(' | '), row] as const))(
      '%s',
      (_title, row) => {
        const { source, declaration, done, printed } = apply(row);
        const { result } = row;
        if ('writes' in result) {
          expect(done).toEqual({ ok: true, changed: true });
          expect(printed.split('\n').at(-1)).toBe(`${declaration} ${result.writes};`);
        } else if ('refused' in result) {
          expect(done).toMatchObject({
            ok: false,
            changed: false,
            diagnostic: { code: result.refused },
          });
          expect(printed).toBe(source);
        } else {
          expect(done).toMatchObject(
            'code' in result
              ? { kind: result.inspects, diagnostic: { code: result.code } }
              : { kind: result.inspects }
          );
        }
      }
    );
  });

  it.each([
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

  it('refuses a missing parent after a local object with the field, then an import, either of which may provide it', () => {
    const source = `export default { title: 'X' };\nimport { Two } from './stories';\nconst One = { args: { stale: 1 } };\nexport const A = { ...One, ...Two };`;
    const csf = parse(source);
    const [story] = csf.objects({ meta: false });

    expect(story.set(['args', 'a'], 'x')).toMatchObject({
      ok: false,
      diagnostic: { code: 'spread-field', path: ['args', 'a'] },
    });
    expect(printCsf(csf).code).toBe(source);
  });

  it.each([
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
    ['an alias', 'const Base = { render: () => null };\nconst Alias = Base;'],
    [
      'a method called in a function that runs at the top level',
      'const Base = { render: () => null, setup() { this.args = { x: 1 }; } };\n(() => Base.setup())();',
    ],
    [
      'a method called through a tagged template',
      'const Base = { render: () => null, setup() { this.args = { x: 1 }; } };\nBase.setup``;',
    ],
    [
      'a getter',
      'const Base = { render: () => null, get ready() { this.args = { x: 1 }; return true; } };',
    ],
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

    expect(story.set(['args'], { onClick: { ...parseExpression('() => {}') } })).toMatchObject({
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
    ['meta with a call argument', `const meta = preview.meta(makeMeta());`, { kind: 'meta' }],
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

  it('edits a standalone CSF4 meta call without an argument', () => {
    const csf = parse(`import preview from './preview';\npreview.meta();`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.set(['title'], 'Example')).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      `import preview from './preview';\npreview.meta({ title: 'Example' });`
    );
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
      expect(csf.changed).toBe(false);
    });

    it('resets changed when a transaction started on the editor rolls back', () => {
      const csf = parse(source);
      const [meta, story] = csf.objects();

      const kept = csf.editor.transaction(() => {
        meta.set(['parameters', 'a'], 1);
        return false;
      });

      expect(kept).toBe(false);
      expect(printCsf(csf).code).toBe(source);
      expect(meta.changed).toBe(false);
      expect(csf.changed).toBe(false);

      story.remove(['parameters', 'msw']);
      expect(csf.editor.transaction(() => (meta.set(['parameters', 'a'], 1), false))).toBe(false);
      expect(csf.changed).toBe(true);
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

    it('resets the config changed when a transaction started on the editor rolls back', () => {
      const code = "export default { layout: 'centered', tags: ['a'] };";
      const config = loadConfig(code).parse();

      const kept = config.editor.transaction(() => {
        config.remove(['layout']);
        config.appendValueToArray(['tags'], 'b');
        return false;
      });

      expect(kept).toBe(false);
      expect(printConfig(config).code).toBe(code);
      expect(config.changed).toBe(false);
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

describe('CsfObject element and argument paths', () => {
  const edit = (source: string, mutate: (config: ConfigFile) => unknown) => {
    const config = loadConfig(source).parse();
    expect(mutate(config)).toEqual({ ok: true, changed: true });
    return printConfig(config).code;
  };

  it('prints a path with its indexes', () => {
    expect(printCsfPath(['parameters', 'msw', 'handlers', 0])).toBe('parameters.msw.handlers[0]');
    expect(printCsfPath(['loaders', 0, 0])).toBe('loaders[0][0]');
    expect(printCsfPath(['parameters', 'a11y'])).toBe('parameters.a11y');
  });

  it('reads an element at its position in the source, which spreads and holes take too', () => {
    const config = loadConfig(
      "export default { addons: [...base, 'a', , getAbsolutePath('b')] };"
    ).parse();
    const addons = config.get(['addons']) as ESTree.ArrayExpression;

    expect(addons.elements.map((element) => element && textOf(element))).toEqual([
      '...base',
      "'a'",
      null,
      "getAbsolutePath('b')",
    ]);
    expect(config.inspect(['addons', 0])).toMatchObject({
      kind: 'unreadable',
      diagnostic: { code: 'spread-field', path: ['addons', 0] },
    });
    expect(textOf(config.get(['addons', 1])!)).toBe("'a'");
    expect(config.inspect(['addons', 2])).toEqual({ kind: 'missing' });
    expect(config.getValue(['addons', 2])).toBeUndefined();
    expect(textOf(config.get(['addons', 3])!)).toBe("getAbsolutePath('b')");
    expect(config.getValue(['addons', 3, 0])).toBe('b');
    expect(config.inspect(['addons', 4])).toEqual({ kind: 'missing' });
    expect(config.inspect(['addons', 4, 0])).toEqual({ kind: 'missing' });
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it('reads the arguments of a story loader and the members of an element', () => {
    const csf = parse(
      "export default {};\nexport const A = { loaders: [mswLoader({ quiet: true })], args: { items: [{ id: 'a' }] } };"
    );
    const [story] = csf.objects({ meta: false });

    expect(story.getValue(['loaders', 0, 0, 'quiet'])).toBe(true);
    expect(story.getValue(['args', 'items', 0, 'id'])).toBe('a');
    expect(story.inspect(['loaders', 0, 1])).toEqual({ kind: 'missing' });
  });

  it('refuses an index into an object and a key into a list', () => {
    const config = loadConfig("export default { parameters: { a: 1 }, addons: ['a'] };").parse();

    expect(config.inspect([0])).toMatchObject({ diagnostic: { code: 'unsupported-member' } });
    expect(config.inspect(['parameters', 0])).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.inspect(['addons', 'length'])).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.set(['parameters', 0], 'x')).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-member', path: ['parameters', 0] },
    });
    expect(config.set(['addons', -1], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.remove(['addons', 0.5])).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.changed).toBe(false);
  });

  it.each([-1, 0.5, Number.NaN])(
    'reads the index %s, which is no position, as unsupported',
    (index) => {
      const config = loadConfig("export default { addons: ['a'] };").parse();

      expect(config.inspect(['addons', index])).toMatchObject({
        kind: 'unreadable',
        diagnostic: { code: 'unsupported-member' },
      });
      expect(config.get(['addons', index])).toBeUndefined();
    }
  );

  it('addresses the arguments of an optional call', () => {
    const source = "export default { framework: getAbsolutePath?.('react') };";

    expect(loadConfig(source).parse().getValue(['framework', 0])).toBe('react');
    expect(edit(source, (config) => config.append(['framework'], 'x'))).toBe(
      "export default { framework: getAbsolutePath?.('react', 'x') };"
    );
    expect(edit(source, (config) => config.set(['framework', 0], 'vue'))).toBe(
      "export default { framework: getAbsolutePath?.('vue') };"
    );
  });

  it('replaces an element in place, keeping the layout of its array', () => {
    expect(
      edit("export default {\n  addons: [\n    'a',\n    'b',\n  ],\n};", (config) =>
        config.set(['addons', 1], { name: 'b', options: { x: 1 } })
      )
    ).toBe(
      "export default {\n  addons: [\n    'a',\n    { name: 'b', options: { x: 1 } },\n  ],\n};"
    );
    expect(
      edit("export default { framework: getAbsolutePath('react') };", (config) =>
        config.set(['framework', 0], '@storybook/react-vite')
      )
    ).toBe("export default { framework: getAbsolutePath('@storybook/react-vite') };");
  });

  it('indents a multi-line element like the line of the element it replaces', () => {
    expect(
      edit('export default {\n  loaders: [\n    a,\n  ],\n};', (config) =>
        config.set(['loaders', 0], parseExpression('async () => {\n  await a();\n}'))
      )
    ).toBe('export default {\n  loaders: [\n    async () => {\n      await a();\n    },\n  ],\n};');
  });

  it.each([
    ['[a, , b]', '[a, x, b]'],
    ['[a,,b]', '[a,x,b]'],
    ['[, b]', '[x, b]'],
    ['[a, ,]', '[a, x,]'],
  ])('fills the hole of %s without a stray space', (array, filled) => {
    expect(
      edit(`export default { addons: ${array} };`, (config) =>
        config.set(['addons', array.startsWith('[,') ? 0 : 1], parseExpression('x'))
      )
    ).toBe(`export default { addons: ${filled} };`);
  });

  it('fills a hole with a text ending in a line comment, taking the comma of the hole', () => {
    expect(
      edit("export default {\n  addons: [\n    'a',\n    ,\n    'b',\n  ],\n};", (config) =>
        config.set(['addons', 1], parseExpression("'x' // c"))
      )
    ).toBe("export default {\n  addons: [\n    'a',\n    'x', // c\n    'b',\n  ],\n};");
  });

  it('takes the comma after an element for a text ending in a line comment, like a field', () => {
    const value = parseExpression("'x' // c");

    expect(
      edit("export default {\n  addons: [\n    'a',\n    'b',\n  ],\n};", (config) =>
        config.set(['addons', 0], value)
      )
    ).toBe("export default {\n  addons: [\n    'x', // c\n    'b',\n  ],\n};");
    expect(
      edit("export default {\n  a: 'a',\n  b: 'b',\n};", (config) => config.set(['a'], value))
    ).toBe("export default {\n  a: 'x', // c\n  b: 'b',\n};");
    expect(
      edit("export default {\n  addons: [\n    'a',\n    'b',\n  ],\n};", (config) =>
        config.transform(['addons', 0], () => value)
      )
    ).toBe("export default {\n  addons: [\n    'x', // c\n    'b',\n  ],\n};");
  });

  it('transforms an argument from its current expression', () => {
    expect(
      edit('export default { loaders: [mswLoader(setup)] };', (config) =>
        config.transform(['loaders', 0, 0], (setup) =>
          parseExpression(`{ ...${placeableTextOf(setup)}, quiet: true }`)
        )
      )
    ).toBe('export default { loaders: [mswLoader({ ...setup, quiet: true })] };');
  });

  it('leaves a missing element alone on transform and remove, and refuses to set it', () => {
    const source = "export default { addons: ['a'] };";
    const config = loadConfig(source).parse();

    expect(config.transform(['addons', 1], () => parseExpression('x'))).toEqual({
      ok: true,
      changed: false,
    });
    expect(config.remove(['addons', 1])).toEqual({ ok: true, changed: false });
    expect(config.remove(['addons', 1, 'name'])).toEqual({ ok: true, changed: false });
    expect(config.set(['addons', 1], 'x')).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'unsupported-member',
        message:
          'Cannot create addons[1]: an index addresses an element or argument that exists, and append or prepend adds one',
      },
    });
    expect(config.set(['addons', 1, 'name'], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.set(['loaders', 0], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member', path: ['loaders', 0] },
    });
    expect(config.set(['parameters', 'loaders', 0, 'name'], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);
  });

  it('removes one element, keeping an array it empties', () => {
    expect(
      edit("export default { addons: ['a', 'b', 'c'] };", (config) => config.remove(['addons', 1]))
    ).toBe("export default { addons: ['a', 'c'] };");
    expect(
      edit("export default { parameters: { tags: ['a'] } };", (config) =>
        config.remove(['parameters', 'tags', 0])
      )
    ).toBe('export default { parameters: { tags: [] } };');
    expect(
      edit('export default { loaders: [{ quiet: true }] };', (config) =>
        config.remove(['loaders', 0, 'quiet'])
      )
    ).toBe('export default { loaders: [{}] };');
    expect(
      edit("export default { framework: getAbsolutePath('react') };", (config) =>
        config.remove(['framework', 0])
      )
    ).toBe('export default { framework: getAbsolutePath() };');
  });

  it('removes a hole with its slot', () => {
    expect(
      edit('export default { addons: [a, , b] };', (config) => config.remove(['addons', 1]))
    ).toBe('export default { addons: [a, b] };');
  });

  it('edits the elements before and after a spread, but not the spread', () => {
    const source = 'export default { addons: [a, ...base, b] };';

    expect(edit(source, (config) => config.set(['addons', 0], parseExpression('x')))).toBe(
      'export default { addons: [x, ...base, b] };'
    );
    expect(edit(source, (config) => config.remove(['addons', 2]))).toBe(
      'export default { addons: [a, ...base] };'
    );
    expect(
      edit(source, (config) => config.transform(['addons', 2], () => parseExpression('y')))
    ).toBe('export default { addons: [a, ...base, y] };');

    const config = loadConfig(source).parse();
    expect(config.set(['addons', 1], 'x')).toMatchObject({
      diagnostic: { code: 'spread-field', path: ['addons', 1] },
    });
    expect(config.remove(['addons', 1])).toMatchObject({ diagnostic: { code: 'spread-field' } });
    expect(printConfig(config).code).toBe(source);
  });

  it('renames, moves and groups only properties, also inside an element', () => {
    const source = 'export default { loaders: [{ a: 1 }], b: 2 };';
    const config = loadConfig(source).parse();

    expect(config.rename(['loaders', 0], 'first')).toMatchObject({
      diagnostic: { code: 'unsupported-member', path: ['loaders', 0] },
    });
    expect(config.move(['b'], ['loaders', 1])).toMatchObject({
      diagnostic: { code: 'unsupported-member', path: ['loaders', 1] },
    });
    expect(config.move(['b'], ['missing', 0, 'b'])).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.group(['loaders', 0], ['b'])).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(printConfig(config).code).toBe(source);

    expect(edit(source, (config) => config.rename(['loaders', 0, 'a'], 'c'))).toBe(
      'export default { loaders: [{ c: 1 }], b: 2 };'
    );
    expect(edit(source, (config) => config.move(['b'], ['loaders', 0, 'b']))).toBe(
      'export default { loaders: [{ a: 1, b: 2 }] };'
    );
    expect(edit(source, (config) => config.group(['loaders', 0, 'g'], ['a']))).toBe(
      'export default { loaders: [{ g: { a: 1 } }], b: 2 };'
    );
  });
});

describe('CsfObject append and prepend', () => {
  const edit = (source: string, mutate: (config: ConfigFile) => unknown) => {
    const config = loadConfig(source).parse();
    expect(mutate(config)).toEqual({ ok: true, changed: true });
    return printConfig(config).code;
  };

  it('adds an element at either end of an array, in its layout', () => {
    expect(
      edit("export default { addons: ['a'] };", (config) => config.append(['addons'], 'b'))
    ).toBe("export default { addons: ['a', 'b'] };");
    expect(
      edit("export default { addons: ['a'] };", (config) => config.prepend(['addons'], 'b'))
    ).toBe("export default { addons: ['b', 'a'] };");
    expect(
      edit("export default {\n  addons: [\n    'a',\n  ],\n};", (config) =>
        config.append(['addons'], { name: 'b', options: {} })
      )
    ).toBe("export default {\n  addons: [\n    'a',\n    { name: 'b', options: {} },\n  ],\n};");
    expect(
      edit("export default {\n  addons: [\n    'a',\n  ],\n};", (config) =>
        config.prepend(['addons'], 'b')
      )
    ).toBe("export default {\n  addons: [\n    'b',\n    'a',\n  ],\n};");
  });

  it('re-indents a multi-line node from its own line, at the indent of the array', () => {
    const source = 'export default {\n  a: [\n    [\n      1,\n    ],\n  ],\n  list: [],\n};';
    const output =
      'export default {\n  a: [\n    [\n      1,\n    ],\n  ],\n  list: [\n    [\n      1,\n    ],\n  ],\n};';
    // A child of a `get` node keeps the indent of its line in that node.
    const childOfGet = (config: ConfigFile) => {
      const array = config.get(['a']);
      return (array?.type === 'ArrayExpression' ? array.elements[0] : array) as CsfExpression;
    };

    expect(edit(source, (config) => config.append(['list'], config.get(['a', 0])!))).toBe(output);
    expect(edit(source, (config) => config.append(['list'], childOfGet(config)))).toBe(output);
  });

  it('adds an element next to a spread, which keeps its place', () => {
    const source = "export default { addons: [...base.addons], framework: 'f' };";

    expect(edit(source, (config) => config.append(['addons'], 'x'))).toBe(
      "export default { addons: [...base.addons, 'x'], framework: 'f' };"
    );
    expect(edit(source, (config) => config.prepend(['addons'], 'x'))).toBe(
      "export default { addons: ['x', ...base.addons], framework: 'f' };"
    );
  });

  it('creates a missing array on either side of the spread it carries forward', () => {
    const source = "const shared = { addons: ['a'] };\nexport default { ...shared };";

    expect(edit(source, (config) => config.append(['addons'], 'x')).split('\n')[1]).toBe(
      "export default { ...shared, addons: [...(shared.addons ?? []), 'x'] };"
    );
    expect(edit(source, (config) => config.prepend(['addons'], 'x')).split('\n')[1]).toBe(
      "export default { ...shared, addons: ['x', ...(shared.addons ?? [])] };"
    );
    expect(
      edit('export default {};', (config) => config.append(['parameters', 'docs', 'tags'], 'x'))
    ).toBe('export default { parameters: { docs: { tags: ["x"] } } };');
  });

  it('adds an argument to a call, hugging the parentheses of an empty one', () => {
    expect(
      edit('export default { loaders: [mswLoader(a)] };', (config) =>
        config.append(['loaders', 0], parseExpression('b'))
      )
    ).toBe('export default { loaders: [mswLoader(a, b)] };');
    expect(
      edit('export default {\n  loaders: [mswLoader()],\n};', (config) =>
        config.append(['loaders', 0], parseExpression('async () => {\n  await setup();\n}'))
      )
    ).toBe('export default {\n  loaders: [mswLoader(async () => {\n    await setup();\n  })],\n};');
    expect(
      edit('export default { loaders: [mswLoader( )] };', (config) =>
        config.prepend(['loaders', 0], parseExpression('setup'))
      )
    ).toBe('export default { loaders: [mswLoader(setup)] };');
  });

  it('keeps the line of a line comment it appends to an empty call', () => {
    expect(
      edit('export default { framework: getAbsolutePath() };', (config) =>
        config.append(['framework'], parseExpression("'react' // c"))
      )
    ).toBe("export default { framework: getAbsolutePath(\n  'react', // c\n) };");
  });

  it('refuses a field that holds neither an array nor a call, and an item it would create', () => {
    const source = "export default { addons: 5, framework: { name: 'x' }, loaders: [] };";
    const config = loadConfig(source).parse();

    expect(config.append(['addons'], 'x')).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'unsupported-value',
        path: ['addons'],
        message: "Expected an array literal or a call at 'addons', got 'Literal'",
      },
    });
    expect(config.prepend(['framework'], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-value' },
    });
    expect(config.append(['loaders', 0], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member', path: ['loaders', 0] },
    });
    expect(config.append(['missing', 0], 'x')).toMatchObject({
      diagnostic: { code: 'unsupported-member' },
    });
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);
  });

  it('refuses to add to a constant that other code refers to as well', () => {
    const source = "const addons = ['a'];\nexport default { addons, other: addons };";
    const config = loadConfig(source).parse();

    expect(config.append(['addons'], 'b')).toMatchObject({
      diagnostic: {
        code: 'unsupported-value',
        message: "Cannot add to 'addons', a constant that other code refers to as well",
      },
    });
    expect(printConfig(config).code).toBe(source);
  });

  it('refuses to append to an array a later spread could replace', () => {
    const source = "export default { addons: ['a'], ...base };";
    const config = loadConfig(source).parse();

    expect(config.append(['addons'], 'x')).toMatchObject({
      diagnostic: { code: 'spread-field', path: ['addons'] },
    });
    expect(printConfig(config).code).toBe(source);
  });

  it('rolls back an append and `changed` with a transaction a later edit refuses', () => {
    const source = "export default { addons: ['a'], tags: ['b'] };";
    const config = loadConfig(source).parse();

    expect(
      config.transaction(() => {
        expect(config.append(['addons'], 'x')).toEqual({ ok: true, changed: true });
        expect(config.changed).toBe(true);
        config.set(['tags', 'value'], 'c');
      })
    ).toBe(false);
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);

    const csf = parse("export default { tags: ['a'] };");
    const [meta] = csf.objects({ stories: false });
    csf.transaction(() => {
      meta.prepend(['tags'], 'x');
      meta.set(['tags', 'value'], 'c');
    });
    expect(meta.changed).toBe(false);
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe("export default { tags: ['a'] };");
  });
});

describe('CsfObject pending edits', () => {
  const stories = `export default { title: 'A' };
export const Primary = { args: { label: 'A' } };
export const Secondary = { args: {} };
`;

  it('leaves the edit of a field the index does not read pending, and commits one it reads', () => {
    const csf = parse(stories);
    const [primary] = csf.objects({ meta: false });

    expect(primary.set(['args', 'disabled'], true)).toEqual({ ok: true, changed: true });
    expect(csf.editor._committed).toEqual([]);
    expect(csf.editor.pending).toBe(true);
    expect(primary.getValue(['args', 'disabled'])).toBe(true);

    expect(primary.set(['tags'], ['docs'])).toEqual({ ok: true, changed: true });
    expect(csf.editor.pending).toBe(false);
    expect(csf.stories[0].tags).toEqual(['docs']);
    expect(printCsf(csf).code).toContain(
      "export const Primary = { args: { label: 'A', disabled: true }, tags: ['docs'] };"
    );
  });

  it('refuses a field the index rejects alone, keeping the edits pending before it', () => {
    const csf = parse(stories);
    const [primary, secondary] = csf.objects({ meta: false });
    primary.set(['args', 'disabled'], true);

    expect(secondary.set(['tags'], 1)).toMatchObject({
      ok: false,
      diagnostic: { code: 'invalid-csf' },
    });
    expect(csf.editor.pending).toBe(true);
    expect(csf.stories.map(({ tags }) => tags)).toEqual([undefined, undefined]);
    expect(printCsf(csf).code).toBe(
      stories.replace("label: 'A' }", "label: 'A', disabled: true }")
    );
  });

  it('keeps the nodes of the parse, so raw edits join the same batch', () => {
    const csf = parse(stories);
    const [primary, secondary] = csf.objects({ meta: false });
    const node = secondary.node!;
    primary.set(['args', 'disabled'], true);

    expect(secondary.node).toBe(node);
    appendMembers(csf.editor, node, ['parameters: {}']);
    expect(printCsf(csf).code).toContain('export const Secondary = { args: {}, parameters: {} };');
  });

  it('throws for a node a pending mutation wrote over', () => {
    const csf = parse(stories);
    const [primary] = csf.objects({ meta: false });
    const args = (primary.node!.properties[0] as ESTree.ObjectProperty).value;
    primary.set(['args'], { size: 'large' });

    expect(() => appendMembers(csf.editor, args as ESTree.ObjectExpression, ['a: 1'])).toThrow(
      'that a pending edit wrote over'
    );
  });

  it('reads and writes a field again after a pending edit to it, committing first', () => {
    const csf = parse(stories);
    const [primary] = csf.objects({ meta: false });
    primary.set(['args', 'size'], 'small');
    primary.set(['args', 'size'], 'large');
    primary.transform(['args', 'size'], (value) => parseExpression(`${textOf(value)} + 'r'`));

    expect(textOf(primary.get(['args', 'size'])!)).toBe("'large' + 'r'");
    expect(printCsf(csf).code).toContain(
      "export const Primary = { args: { label: 'A', size: 'large' + 'r' } };"
    );
  });

  it('removes what pending edits emptied, and adds to what they created', () => {
    const csf = parse(
      `export default {};\nexport const A = { args: { a: 1 }, argTypes: { a: { defaultValue: 1 } } };\n`
    );
    const [story] = csf.objects({ meta: false });
    story.remove(['argTypes', 'a', 'defaultValue']);
    story.set(['parameters', 'docs', 'a'], 1);
    story.set(['parameters', 'docs', 'b'], 2);
    story.remove(['args', 'a']);

    expect(printCsf(csf).code).toBe(
      'export default {};\nexport const A = { parameters: { docs: { a: 1, b: 2 } } };\n'
    );
  });

  it('commits a value that names a binding, whose references the next proof counts', () => {
    const csf = parse(`export default {};\nconst base = { a: 1 };\nexport const A = {};\n`);
    const [story] = csf.objects({ meta: false });

    story.set(['args'], parseExpression('{ ...base }'));
    expect(csf.editor.pending).toBe(false);
    story.set(['args', 'b'], 2);
    expect(csf.editor.pending).toBe(true);
    expect(printCsf(csf).code).toContain('export const A = { args: { ...base, b: 2 } };');
  });

  it('adds the assignments of a story without an object once', () => {
    const csf = parse(`export default {};\nexport const A = () => null;\n`);
    const [story] = csf.objects({ meta: false });
    story.set(['args', 'a'], 1);
    story.set(['args', 'b'], 2);
    story.set(['parameters', 'c'], 3);

    expect(printCsf(csf).code).toBe(
      'export default {};\nexport const A = () => null;\nA.args = { a: 1, b: 2 };\nA.parameters = { c: 3 };\n'
    );
  });

  it('adds the assignments of two stories of one declaration in the order of commits between them', () => {
    const csf = parse(`export default {};\nexport const A = () => 1, B = () => 2;\n`);
    const [a, b] = csf.objects({ meta: false });
    a.set(['args'], { a: 1 });
    b.set(['parameters'], { p: 1 });

    expect(printCsf(csf).code).toBe(
      'export default {};\nexport const A = () => 1, B = () => 2;\nB.parameters = { p: 1 };\nA.args = { a: 1 };\n'
    );
  });

  it('throws for a value that does not parse, as a commit does', () => {
    const csf = parse(stories);
    const [primary] = csf.objects({ meta: false });
    const method = { m() {} }.m;

    expect(() => primary.set(['args', 'm'], method as never)).toThrow();
    expect(printCsf(csf).code).toBe(stories);
  });

  it('commits before writing to an object a root that cannot tell its pending edits wrote', () => {
    const editor = new SourceEditor('const meta = preview.meta({});\nmeta.story();\n');
    const call = () =>
      (editor.program.body[1] as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const root = (): ObjectRoot => {
      const [argument] = call().arguments;
      if (argument?.type === 'ObjectExpression') {
        return literalRoot(editor, argument);
      }
      const write = (members: { text: string }[]) =>
        editor.edits.appendLeft(
          call().end - 1,
          `{ ${members.map((member) => member.text).join(', ')} }`
        );
      const none = () => {
        throw new Error('no members');
      };
      return {
        properties: [],
        detached: false,
        append: write,
        prepend: write,
        remove: none,
        replaceValue: none,
        rename: none,
        group: none,
        take: none,
      };
    };
    const story = createCsfObject(
      { kind: 'story', exportName: 'A', localName: 'A' },
      { editor, root },
      () => {},
      () => {}
    );

    story.set(['args', 'a'], 1);
    story.set(['args', 'b'], 2);
    expect(editor.toString()).toBe(
      'const meta = preview.meta({});\nmeta.story({ args: { a: 1, b: 2 } });\n'
    );
  });

  it('commits raw edits that name a binding before a mutation, also after a refused one', () => {
    const csf = parse(
      `export default {};\nconst Base = { a: 1 };\nexport const A = { args: Base };\nexport const B = {};\n`
    );
    const [a, b] = csf.objects({ meta: false });
    appendMembers(csf.editor, b.node!, ['args: Base']);

    expect(a.set(['__proto__'], 1)).toMatchObject({ ok: false });
    expect(a.set(['args', 'a'], 2)).toMatchObject({
      ok: false,
      diagnostic: { code: 'unsupported-member' },
    });
    expect(printCsf(csf).code).toContain('const Base = { a: 1 };');
  });

  it('lays out an append after a pending prepend to the same list as a commit between them', () => {
    const csf = parse(`export default {};\nexport const A = { args: { list: [1] } };\n`);
    const [a] = csf.objects({ meta: false });
    a.prepend(['args', 'list'], 0);
    a.append(['args', 'list'], parseExpression('() => {\n  return 1;\n}'));

    expect(printCsf(csf).code).toBe(
      'export default {};\nexport const A = { args: { list: [\n  0,\n  1,\n  () => {\n    return 1;\n  }\n] } };\n'
    );
  });

  it('still throws for a read of an object that is gone', () => {
    const csf = parse(stories);
    const [primary] = csf.objects({ meta: false });
    const statement = csf.editor.program.body[1];
    csf.editor.edits.remove(statement.start, statement.end);
    csf.editor.commit();

    expect(() => primary.get(['args'])).toThrow('no longer exists');
    expect(() => primary.inspect(['args'])).toThrow('no longer exists');
  });

  it('reads a config field after a pending mutation of it', () => {
    const config = loadConfig("export default { framework: 'a' };").parse();
    config.set(['framework'], { name: 'a', options: {} });

    expect(config.getFieldNode(['framework'])?.type).toBe('ObjectExpression');
    expect(config.getNameFromPath(['framework'])).toBe('a');
  });
});
