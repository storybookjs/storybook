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
];

describe('ConfigFile.objects', () => {
  it.each(configurations)('uses the same mutation API for %s', (source) => {
    const config = loadConfig(source).parse();
    const [object] = config.objects();

    expect(object.target).toEqual({ kind: 'config' });
    expect(object.rename(['parameters', 'a11y', 'element'], 'context')).toEqual({ ok: true, changed: true });
    expect(config.getFieldValue(['parameters', 'a11y', 'context'])).toBe('#root');
    expect(object.move(['parameters', 'a11y', 'context'], ['globals', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(object.get(['parameters'])).toBeUndefined();
    expect(object.transform(['globals', 'a11y'], () => t.stringLiteral('#app'))).toEqual({ ok: true, changed: true });
    expect(object.set(['tags'], t.arrayExpression([t.stringLiteral('autodocs')]))).toEqual({ ok: true, changed: true });

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getFieldValue(['globals', 'a11y'])).toBe('#app');
    expect(output.getFieldValue(['tags'])).toEqual(['autodocs']);
    expect(output.getFieldNode(['parameters'])).toBeUndefined();
    expect(config.getFieldValue(['globals', 'a11y'])).toBe('#app');
    expect(object.changed).toBe(true);
    expect(config.changed).toBe(true);
    expect(config.mutationDiagnostics).toEqual([]);

    expect(object.remove(['globals', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(loadConfig(printConfig(config).code).parse().getFieldNode(['globals'])).toBeUndefined();
  });

  it.each(configurations)('keeps missing-field operations unchanged for %s', (source) => {
    const config = loadConfig(source).parse();
    const [object] = config.objects();

    expect(object.remove(['parameters', 'missing'])).toEqual({ ok: true, changed: false });
    expect(object.rename(['parameters'], 'parameters')).toEqual({ ok: true, changed: false });
    expect(printConfig(config).code).toBe(source);
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it.each([
    [`export default { parameters: { a11y: { element: '#root', ...base } } };`, 'spread-field'],
    [`export const parameters = { a11y: { element: '#root', [field]: true } };`, 'dynamic-key'],
    [`export default { parameters: { a11y: { element: '#root', element: '#app' } } };`, 'duplicate-field'],
    [`export default { parameters: { a11y: { element: '#root', context: '#app' } } };`, 'occupied-destination'],
    [`export default { parameters: { a11y: createA11y() } };`, 'unsupported-member'],
  ])('reports unsafe paths in %s', (source, code) => {
    const config = loadConfig(source).parse();
    const [object] = config.objects();

    expect(object.rename(['parameters', 'a11y', 'element'], 'context')).toMatchObject({ ok: false, diagnostic: { code } });
    expect(printConfig(config).code).toBe(source);
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toContainEqual(expect.objectContaining({ code, target: { kind: 'config' } }));
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
  ])('does not expose unsafe config bindings in %s', (source) => {
    const config = loadConfig(source).parse();

    expect(config.objects()).toEqual([]);
    expect(config.mutationDiagnostics).not.toEqual([]);
    expect(config.changed).toBe(false);
    expect(printConfig(config).code).toBe(source);
  });

  it('preserves comments and property order when renaming a preview parameter', () => {
    const source = `export default { parameters: { a11y: {
      config: {},
      // Keep the selector scoped to this application.
      element: '#root',
      options: {},
    } } };`;
    const config = loadConfig(source).parse();
    const [object] = config.objects();

    object.rename(['parameters', 'a11y', 'element'], 'context');

    expect(printConfig(config).code).toBe(source.replace('element:', 'context:'));
  });

  it('renames and removes named scalar exports without changing their siblings', () => {
    const config = loadConfig(`export const oldName = 'value', sibling = true;`).parse();
    const [object] = config.objects();

    expect(object.rename(['oldName'], 'newName')).toEqual({ ok: true, changed: true });
    expect(config.getFieldValue(['newName'])).toBe('value');
    expect(object.remove(['newName'])).toEqual({ ok: true, changed: true });
    expect(printConfig(config).code).toBe('export const sibling = true;');
  });

  it('can create named exports in an empty file', () => {
    const config = loadConfig('').parse();
    const [object] = config.objects();

    object.set(['framework'], t.stringLiteral('@storybook/react-vite'));
    object.set(['parameters', 'a11y', 'context'], t.stringLiteral('#app'));

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getFieldValue(['framework'])).toBe('@storybook/react-vite');
    expect(output.getFieldValue(['parameters', 'a11y', 'context'])).toBe('#app');
  });

  it.each(['local', 'custom-field'])('avoids binding collisions when renaming an export to %s', (name) => {
    const config = loadConfig(`const local = 'keep'; export const original = 'value';`).parse();
    const [object] = config.objects();

    expect(object.rename(['original'], name)).toEqual({ ok: true, changed: true });
    expect(object.set([name], t.stringLiteral('updated'))).toEqual({ ok: true, changed: true });

    const output = printConfig(config).code;
    expect(output).toContain(`const local = 'keep'`);
    expect(loadConfig(output).parse().getFieldValue([name])).toBe('updated');
    expect(object.remove([name])).toEqual({ ok: true, changed: true });
    expect(loadConfig(printConfig(config).code).parse().getFieldNode([name])).toBeUndefined();
  });
});
