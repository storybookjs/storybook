import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { loadConfig, printConfig } from './ConfigFile.ts';

const configurations = [
  `export default { parameters: { a11y: { element: '#root' } } };`,
  `const config = { parameters: { a11y: { element: '#root' } } } satisfies Preview; export default config;`,
  `export default definePreview({ parameters: { a11y: { element: '#root' } } }).type<Preview>();`,
  `module.exports = { parameters: { a11y: { element: '#root' } } };`,
  `const config = { parameters: { a11y: { element: '#root' } } }; module.exports = config;`,
  `export const parameters = { a11y: { element: '#root' } };`,
  `const params = { a11y: { element: '#root' } }; export { params as parameters };`,
  `const config = { parameters: { a11y: { element: '#root' } } }; export { config as default };`,
  `const config = { parameters: { a11y: { element: '#root' } } }; export default config satisfies Preview;`,
];

describe('ConfigFile mutations', () => {
  it('keeps local bindings readable after setting an expression returned by get', () => {
    const config = loadConfig(`
      const params = { a11y: { element: '#app' } };
      export default { parameters: params };
    `).parse();

    expect(config.getValue(['parameters', 'a11y', 'element'])).toBe('#app');
    expect(config.set(['parameters'], config.get(['parameters']))).toEqual({
      ok: true,
      changed: true,
    });

    expect.soft(config.getValue(['parameters', 'a11y', 'element'])).toBe('#app');
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    'let config; config = definePreview({ parameters: { legacy: true } }); module.exports = config;',
    'export default {}; definePreview({ parameters: { legacy: true } });',
    'export const parameters = {}; export default { parameters: { legacy: true } };',
    'export default configure({ parameters: { legacy: true } });',
    'export default Object.assign({ parameters: { legacy: true } }, other);',
    'export default definePreview({ parameters: { legacy: true } }).finalize();',
    'const definePreview = (value) => other; export default definePreview({ parameters: { legacy: true } });',
  ])('rejects ambiguous config roots in %s', (source) => {
    const config = loadConfig(source).parse();
    expect(config.remove(['parameters', 'legacy']).ok).toBe(false);
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);
  });

  it('mutates an aliased config factory import', () => {
    const config = loadConfig(
      'import { definePreview as preview } from "@storybook/react"; export default preview({ tags: [] });'
    ).parse();
    expect(config.set(['tags'], ['autodocs']).ok).toBe(true);
    expect(config.getValue(['tags'])).toEqual(['autodocs']);
  });

  it.each(['remove', 'move'] as const)(
    'does not expose a shadowed spread value during %s',
    (operation) => {
      const source = 'export default { parameters: { ...shared, legacy: true } };';
      const config = loadConfig(source).parse();
      const result =
        operation === 'remove'
          ? config.remove(['parameters', 'legacy'])
          : config.move(['parameters', 'legacy'], ['parameters', 'current']);
      expect(result.ok).toBe(false);
      expect(printConfig(config).code).toBe(source);
    }
  );

  it('keeps an empty parent that shadows an earlier spread', () => {
    const config = loadConfig(
      'export default { ...shared, parameters: { legacy: true } };'
    ).parse();
    expect(config.remove(['parameters', 'legacy']).ok).toBe(true);
    expect(config.getValue(['parameters'])).toEqual({});
  });

  it.each([
    'const tags = ["autodocs"]; export default { tags };',
    'const tags = ["autodocs"]; module.exports = { tags };',
    'const values = ["autodocs"]; export { values as tags };',
  ])('reads literal values from %s', (source) => {
    const config = loadConfig(source).parse();
    expect(config.getValue(['tags'])).toEqual(['autodocs']);
    expect(config.get(['tags'])).toBeDefined();
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    'import { tags } from "./shared"; export default { tags };',
    'let tags = []; tags = other; export default { tags };',
    'const tags = [tags]; export default { tags };',
    'const undefined = "shadowed"; use(undefined); export default { value: undefined };',
  ])('does not guess values from %s', (source) => {
    const config = loadConfig(source).parse();
    expect(config.getValue([source.includes('shadowed') ? 'value' : 'tags'])).toBeUndefined();
    expect(config.mutationDiagnostics.length).toBeGreaterThan(0);
  });

  it.each([
    'export default { tags: [] };',
    'module.exports = { tags: [] };',
    'export const tags = [];',
  ])('sets plain values directly in %s', (source) => {
    const config = loadConfig(source).parse();
    const parameters = { a11y: { test: 'todo' }, levels: [0, false, 'dark'] } as const;

    config.set(['tags'], ['autodocs']);
    config.set(['parameters'], parameters);
    config.set(['parameters', 'a11y', 'enabled'], false);
    config.set(['parameters', 'retries'], 2);
    config.set(['parameters', 'a11y', 'test'], 'error');

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getValue(['tags'])).toEqual(['autodocs']);
    expect(output.getValue(['parameters'])).toEqual({
      a11y: { test: 'error', enabled: false },
      levels: [0, false, 'dark'],
      retries: 2,
    });
    expect(config.changed).toBe(true);
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each(configurations)('uses the same mutation API for %s', (source) => {
    const config = loadConfig(source).parse();
    const object = config;

    expect(object.target).toEqual({ kind: 'config' });
    expect(object.rename(['parameters', 'a11y', 'element'], 'context')).toEqual({
      ok: true,
      changed: true,
    });
    expect(config.getValue(['parameters', 'a11y', 'context'])).toBe('#root');
    expect(object.move(['parameters', 'a11y', 'context'], ['globals', 'a11y'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(object.get(['parameters'])).toBeUndefined();
    expect(object.transform(['globals', 'a11y'], () => t.stringLiteral('#app'))).toEqual({
      ok: true,
      changed: true,
    });
    expect(object.set(['tags'], t.arrayExpression([t.stringLiteral('autodocs')]))).toEqual({
      ok: true,
      changed: true,
    });

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getValue(['globals', 'a11y'])).toBe('#app');
    expect(output.getValue(['tags'])).toEqual(['autodocs']);
    expect(output.getFieldNode(['parameters'])).toBeUndefined();
    expect(config.getValue(['globals', 'a11y'])).toBe('#app');
    expect(object.changed).toBe(true);
    expect(config.changed).toBe(true);
    expect(config.mutationDiagnostics).toEqual([]);

    expect(object.remove(['globals', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(loadConfig(printConfig(config).code).parse().getFieldNode(['globals'])).toBeUndefined();
  });

  it.each(configurations)('keeps missing-field operations unchanged for %s', (source) => {
    const config = loadConfig(source).parse();
    const object = config;

    expect(object.remove(['parameters', 'missing'])).toEqual({ ok: true, changed: false });
    expect(object.rename(['parameters'], 'parameters')).toEqual({ ok: true, changed: false });
    expect(printConfig(config).code).toBe(source);
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    [`export default { parameters: { a11y: { element: '#root', ...base } } };`, 'spread-field'],
    [`export const parameters = { a11y: { element: '#root', [field]: true } };`, 'dynamic-key'],
    [
      `export default { parameters: { a11y: { element: '#root', element: '#app' } } };`,
      'duplicate-field',
    ],
    [
      `export default { parameters: { a11y: { element: '#root', context: '#app' } } };`,
      'occupied-destination',
    ],
    [`export default { parameters: { a11y: createA11y() } };`, 'unsupported-member'],
  ])('reports unsafe paths in %s', (source, code) => {
    const config = loadConfig(source).parse();
    const object = config;

    expect(object.rename(['parameters', 'a11y', 'element'], 'context')).toMatchObject({
      ok: false,
      diagnostic: { code },
    });
    expect(printConfig(config).code).toBe(source);
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code, target: { kind: 'config' } })
    );
  });

  it.each([
    `let config = {}; config = other; export default config;`,
    `const config = {}; useConfig(config); export default config;`,
    `export let parameters = {}; parameters = other;`,
    `const parameters = {}; export { parameters, parameters as other };`,
    `module.exports = {}; module.exports = {};`,
    `if (enabled) { module.exports = {}; }`,
    `const module = {}; module.exports = {};`,
    `export { parameters } from './shared';`,
    `export default createConfig();`,
    `const config = definePreview({});`,
    `function configure() { return definePreview({}); }`,
    `const config = {}; export { config as default, config as shared };`,
    `import { parameters } from './shared'; export { parameters };`,
    `module.exports = createConfig();`,
    `module['exports'] = {};`,
    `exports.parameters = {};`,
  ])('does not expose unsafe config bindings in %s', (source) => {
    const config = loadConfig(source).parse();

    expect(config.set(['parameters', 'a11y', 'context'], t.stringLiteral('#app'))).toMatchObject({
      ok: false,
      changed: false,
    });
    expect(config.mutationDiagnostics).not.toEqual([]);
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);
  });

  it.each([
    'export default { async beforeEach(): Promise<void> { setup(); } };',
    'export async function beforeEach(): Promise<void> { setup(); }',
    'async function setupHook(): Promise<void> { setup(); } export { setupHook as beforeEach };',
  ])('transforms hooks while preserving their declaration in %s', (source) => {
    const config = loadConfig(source).parse();

    expect(
      config.transform(['beforeEach'], (value) => {
        if (!t.isFunctionExpression(value)) {
          throw new Error('Expected a function expression');
        }
        return {
          ...value,
          body: t.blockStatement([
            ...value.body.body,
            t.expressionStatement(t.callExpression(t.identifier('spy'), [])),
          ]),
        };
      })
    ).toEqual({ ok: true, changed: true });

    const output = printConfig(config).code;
    expect(output).toContain(source.slice(0, source.indexOf('setup();')).trimEnd());
    expect(output).toContain('setup();');
    expect(output).toContain('spy();');
    expect(loadConfig(output).parse().get(['beforeEach'])).toMatchObject({
      type: 'FunctionExpression',
      async: true,
      returnType: { type: 'TSTypeAnnotation' },
    });
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it('preserves the local name when replacing an exported function', () => {
    const config = loadConfig('export function beforeEach() {}').parse();
    config.set(
      ['beforeEach'],
      t.functionExpression(
        t.identifier('replacement'),
        [],
        t.blockStatement([t.returnStatement(t.identifier('replacement'))])
      )
    );

    const output = printConfig(config).code;
    expect(output).toContain('export const beforeEach = function replacement()');
    expect(loadConfig(output).parse().get(['beforeEach'])).toMatchObject({
      type: 'FunctionExpression',
      id: { name: 'replacement' },
    });
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it('replaces a named function with a value and keeps later edits in sync', () => {
    const config = loadConfig('export function beforeEach() {}').parse();
    config.set(['beforeEach'], t.booleanLiteral(false));
    config.rename(['beforeEach'], 'disabled');
    expect(loadConfig(printConfig(config).code).parse().get(['disabled'])).toMatchObject({
      type: 'BooleanLiteral',
      value: false,
    });
    expect(config.get(['beforeEach'])).toBeUndefined();
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    'const parameters = {}; export default { parameters };',
    'const a11y = {}; export const parameters = { a11y };',
  ])('edits nested local objects in %s', (source) => {
    const config = loadConfig(source).parse();
    config.set(['parameters', 'a11y', 'test'], t.stringLiteral('todo'));
    const output = loadConfig(printConfig(config).code).parse();
    expect(output.get(['parameters', 'a11y', 'test'])).toMatchObject({ value: 'todo' });
    config.move(['parameters', 'a11y', 'test'], ['initialGlobals', 'a11y']);
    expect(config.get(['parameters'])).toBeUndefined();
    expect(config.get(['initialGlobals', 'a11y'])).toMatchObject({ value: 'todo' });
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    'const parameters = {}; use(parameters); export default { parameters };',
    'let parameters = {}; parameters = other; export default { parameters };',
    "import { parameters } from './shared'; export default { parameters };",
    'export default { get parameters() { return {}; } };',
  ])('leaves unsafe nested objects unchanged in %s', (source) => {
    const config = loadConfig(source).parse();
    expect(config.set(['parameters', 'a11y', 'test'], t.stringLiteral('todo'))).toMatchObject({
      ok: false,
    });
    expect(printConfig(config).code).toBe(source);
    expect(config.changed).toBe(false);
  });

  it('preserves comments and property order when renaming a preview parameter', () => {
    const source = `export default { parameters: { a11y: {
      config: {},
      // Keep the selector scoped to this application.
      element: '#root',
      options: {},
    } } };`;
    const config = loadConfig(source).parse();
    const object = config;

    object.rename(['parameters', 'a11y', 'element'], 'context');

    expect(printConfig(config).code).toBe(source.replace('element:', 'context:'));
  });

  it('renames and removes named scalar exports without changing their siblings', () => {
    const config = loadConfig(`export const oldName = 'value', sibling = true;`).parse();
    const object = config;

    expect(object.rename(['oldName'], 'newName')).toEqual({ ok: true, changed: true });
    expect(config.getValue(['newName'])).toBe('value');
    expect(object.remove(['newName'])).toEqual({ ok: true, changed: true });
    expect(printConfig(config).code).toBe('export const sibling = true;');
  });

  it('can create named exports in an empty file', () => {
    const config = loadConfig('').parse();
    const object = config;

    object.set(['framework'], t.stringLiteral('@storybook/react-vite'));
    object.set(['parameters', 'a11y', 'context'], t.stringLiteral('#app'));

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getValue(['framework'])).toBe('@storybook/react-vite');
    expect(output.getValue(['parameters', 'a11y', 'context'])).toBe('#app');
  });

  it.each(['local', 'custom-field'])(
    'avoids binding collisions when renaming an export to %s',
    (name) => {
      const config = loadConfig(`const local = 'keep'; export const original = 'value';`).parse();
      const object = config;

      expect(object.rename(['original'], name)).toEqual({ ok: true, changed: true });
      expect(object.set([name], t.stringLiteral('updated'))).toEqual({ ok: true, changed: true });

      const output = printConfig(config).code;
      expect(output).toContain(`const local = 'keep'`);
      expect(loadConfig(output).parse().getValue([name])).toBe('updated');
      expect(object.remove([name])).toEqual({ ok: true, changed: true });
      expect(loadConfig(printConfig(config).code).parse().getFieldNode([name])).toBeUndefined();
    }
  );
});
