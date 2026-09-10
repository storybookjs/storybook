import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { loadConfig, printConfig } from './ConfigFile.ts';
import { loadCsf, printCsf } from './CsfFile.ts';

const callOptions = {
  importedName: 'addons',
  methodName: 'setConfig',
  moduleNames: ['storybook/manager-api'],
};

describe('CsfObject.group', () => {
  it('preserves expression evaluation order and comments when creating a group', () => {
    const source = `export default {
      before: record('before'),
      // Keep the preferred width.
      width: record('width'),
      height: record('height'),
      after: record('after'),
    };`;
    const config = loadConfig(source).parse();

    expect(config.group(['size'], ['height', 'width'])).toEqual({ ok: true, changed: true });
    const output = printConfig(config).code;
    expect(output).toContain('// Keep the preferred width.');
    const evaluate = (code: string) => {
      const order: string[] = [];
      runInNewContext(code.replace('export default', 'result ='), {
        record: (name: string) => order.push(name),
      });
      return order;
    };
    expect(evaluate(output)).toEqual(evaluate(source));
    expect(evaluate(output)).toEqual(['before', 'width', 'height', 'after']);
    expect(config.group(['size'], ['height', 'width'])).toEqual({ ok: true, changed: false });
    expect(printConfig(config).code).toBe(output);
  });

  it('groups nested fields into an existing object without executing values', () => {
    const config = loadConfig(`export default {
      parameters: {
        width: -10,
        height: [1, { enabled: true }],
        size: ({ unit: 'px' } satisfies Size),
      },
    };`).parse();

    config.group(['parameters', 'size'], ['width', 'height']);

    expect(config.getValue(['parameters'])).toEqual({
      size: { width: -10, height: [1, { enabled: true }], unit: 'px' },
    });
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it('groups named config exports', () => {
    const config = loadConfig('export const width = 100; export const height = 200;').parse();

    config.group(['size'], ['width', 'height']);

    const output = loadConfig(printConfig(config).code).parse();
    expect(output.getValue(['size'])).toEqual({ width: 100, height: 200 });
    expect(output.getValue(['width'])).toBeUndefined();
    expect(output.getValue(['height'])).toBeUndefined();
    expect(config.changed).toBe(true);
    expect(config.mutationDiagnostics).toEqual([]);
  });

  it('groups fields in story objects and CSF2 annotations with the same paths', () => {
    const csf = loadCsf(
      `
      export default { title: 'Example' };
      export const Primary = { parameters: { width: 100, height: 200 } };
      export const Legacy = () => {};
      Legacy.parameters = { width: 100, height: 200 };
    `,
      { makeTitle: (title) => title || 'Example' }
    ).parse();

    for (const object of csf.objects({ meta: false, annotations: ['parameters'] })) {
      object.group(['parameters', 'size'], ['width', 'height']);
    }

    const output = loadCsf(printCsf(csf).code, {
      makeTitle: (title) => title || 'Example',
    }).parse();
    for (const object of output.objects({ meta: false, annotations: ['parameters'] })) {
      expect(object.getValue(['parameters', 'size'])).toEqual({ width: 100, height: 200 });
    }
    expect(csf.changed).toBe(true);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it.each([
    ['spread-field', '{ ...defaults, width: 1 }'],
    ['dynamic-key', "{ ['width']: 1 }"],
    ['duplicate-field', '{ width: 1, width: 2 }'],
    ['duplicate-field', '{ width: 1, size: {}, size: {} }'],
    ['occupied-destination', '{ width: 1, size: { width: 2 } }'],
    ['unsupported-member', '{ width: 1, size: createSize() }'],
    ['unsupported-member', '{ get width() { return 1 } }'],
    ['unsupported-member', '{ width: 1, size: { get height() { return 1 } } }'],
    ['evaluation-order', "{ width: record('width'), other: record('other'), height: 2 }"],
    ['evaluation-order', "{ width: record('width'), size: {} }"],
    ['evaluation-order', '{ width: +[], size: {} }'],
  ])('leaves the source untouched on %s for %s', (code, object) => {
    const source = `export default ${object};`;
    const config = loadConfig(source).parse();

    expect(config.group(['size'], ['width', 'height'])).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code, path: ['size'] },
    });
    expect(config.changed).toBe(false);
    expect(config.mutationDiagnostics).toHaveLength(1);
    expect(printConfig(config).code).toBe(source);
  });

  it('ignores absent source fields, including in an object with a spread', () => {
    const source = 'export default { ...defaults, theme };';
    const config = loadConfig(source).parse();

    expect(config.group(['size'], ['width'])).toEqual({ ok: true, changed: false });
    expect(config.mutationDiagnostics).toEqual([]);
    expect(printConfig(config).code).toBe(source);
  });
});

describe('ConfigFile.callArguments', () => {
  it('exposes the shared read and mutation methods and tracks file changes', () => {
    const config = loadConfig(`import { addons } from 'storybook/manager-api';
      addons.setConfig({ width: 1, obsolete: false });`).parse();
    const [object] = config.callArguments(callOptions);

    object.set(['height'], 2);
    object.remove(['obsolete']);
    object.rename(['width'], 'preferredWidth');
    object.move(['preferredWidth'], ['width']);
    object.transform(['height'], () => object.get(['width']));
    expect(object.getValue(['height'])).toBe(1);
    expect(config.changed).toBe(true);
    expect(config.mutationDiagnostics).toEqual([]);
    const [output] = loadConfig(printConfig(config).code).parse().callArguments(callOptions);
    expect(output.getValue(['width'])).toBe(1);
    expect(output.getValue(['height'])).toBe(1);
    expect(output.getValue(['obsolete'])).toBeUndefined();
  });

  it.each(['config', '...configs', 'getConfig()'])(
    'reports an unsupported argument: %s',
    (argument) => {
      const source = `import { addons } from 'storybook/manager-api'; addons.setConfig(${argument});`;
      const config = loadConfig(source).parse();

      expect(config.callArguments(callOptions)).toEqual([]);
      expect(config.mutationDiagnostics).toMatchObject([
        {
          code: 'unsupported-initializer',
          target: { kind: 'call-argument', importedName: 'addons', methodName: 'setConfig' },
        },
      ]);
      expect(config.changed).toBe(false);
      expect(printConfig(config).code).toBe(source);
    }
  );

  it('rejects a reassigned CommonJS binding', () => {
    const config = loadConfig(`let { addons } = require('storybook/manager-api');
      addons = other;
      addons.setConfig({ width: 1 });`).parse();

    expect(config.callArguments(callOptions)).toEqual([]);
    expect(config.mutationDiagnostics).toMatchObject([{ code: 'ambiguous-binding' }]);
  });

  it('ignores calls without arguments', () => {
    const config = loadConfig(
      `import { addons } from 'storybook/manager-api'; addons.setConfig();`
    ).parse();

    expect(config.callArguments(callOptions)).toEqual([]);
    expect(config.mutationDiagnostics).toEqual([]);
    expect(config.changed).toBe(false);
  });
});
