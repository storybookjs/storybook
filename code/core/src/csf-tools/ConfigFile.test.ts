import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { formatConfig, loadConfig, printConfig } from './ConfigFile.ts';
import type { CsfExpression } from './CsfObject.ts';
import { parseExpression } from './estree/ast.ts';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: (val) => true,
});

const getField = (path: string[], source: string) => {
  const config = loadConfig(source).parse();
  return config.getValue(path);
};

const setField = (path: string[], value: any, source: string) => {
  const config = loadConfig(source).parse();
  expect(config.set(path, value)).toMatchObject({ ok: true });
  return printConfig(config).code;
};

const appendToArray = (path: string[], value: any, source: string) => {
  const config = loadConfig(source).parse();
  config.appendValueToArray(path, value);
  return printConfig(config).code;
};

describe('ConfigFile', () => {
  it('edits its source through editor and program, and their deprecated aliases', () => {
    const config = loadConfig('export default { a: 1 };').parse();

    expect(config._editor).toBe(config.editor);
    expect(config._program).toBe(config.program);
    config.editor.edits.append('\nexport const b = 2;');
    config.editor.commit();

    expect(config.program.body).toHaveLength(2);
    expect(config.getValue(['a'])).toBe(1);
  });

  it.each([
    `export default { parameters: { viewport: { disable: true } } };`,
    `export default definePreview({ parameters: { viewport: { disable: true } } });`,
    `export const parameters = { viewport: { disable: true } };`,
    `export default {};`,
  ])('keeps nested fields readable and removable after setting them in %s', (source) => {
    const config = loadConfig(source).parse();

    config.set(['parameters', 'viewport', 'options'], {});
    expect(config.getValue(['parameters', 'viewport', 'options'])).toEqual({});
    if (source.includes('disable: true')) {
      expect(config.getValue(['parameters', 'viewport', 'disable'])).toBe(true);
    }
    config.remove(['parameters', 'viewport', 'disable']);
    config.set(['parameters', 'viewport', 'disabled'], true);

    const reparsed = loadConfig(printConfig(config).code).parse();
    expect(config.getValue(['parameters'])).toEqual({
      viewport: { options: {}, disabled: true },
    });
    expect(reparsed.getValue(['parameters'])).toEqual(config.getValue(['parameters']));
  });

  describe('callArguments', () => {
    it('finds binding-safe method calls on aliased named imports', () => {
      const config = loadConfig(dedent`
        import { addons as managerAddons } from 'storybook/manager-api';

        managerAddons.setConfig({ showNav: false });
        managerAddons['setConfig']({ showPanel: false });

        function configure(managerAddons: { setConfig: (value: unknown) => void }) {
          managerAddons.setConfig({ showToolbar: false });
        }
      `).parse();

      const calls = config.callArguments({
        importedName: 'addons',
        methodName: 'setConfig',
        moduleNames: ['storybook/manager-api', '@storybook/manager-api'],
      });

      expect(calls).toHaveLength(2);
      expect(calls[0].getValue(['showNav'])).toBe(false);
      expect(calls[1].getValue(['showPanel'])).toBe(false);

      calls[0].group(['layout'], ['showNav']);
      expect(config.changed).toBe(true);
      expect(config.mutationDiagnostics).toEqual([]);
      expect(printConfig(config).code).toContain('layout: {');
      expect(calls[0].getValue(['layout', 'showNav'])).toBe(false);
    });

    it('ignores other modules and type-only imports', () => {
      const config = loadConfig(dedent`
        import { addons } from 'other-package';
        import type { addons as typeAddons } from 'storybook/manager-api';
        addons.setConfig({ showNav: false });
        typeAddons.setConfig({ showPanel: false });
      `).parse();

      expect(
        config.callArguments({
          importedName: 'addons',
          methodName: 'setConfig',
          moduleNames: ['storybook/manager-api'],
        })
      ).toHaveLength(0);
    });

    it('finds binding-safe method calls on destructured CommonJS imports', () => {
      const config = loadConfig(dedent`
        const { addons: managerAddons } = require('storybook/manager-api');

        managerAddons.setConfig({ showNav: false });

        function configure(managerAddons) {
          managerAddons.setConfig({ showPanel: false });
        }
      `).parse();

      const calls = config.callArguments({
        importedName: 'addons',
        methodName: 'setConfig',
        moduleNames: ['storybook/manager-api'],
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].getValue(['showNav'])).toBe(false);
    });

    it('finds same-named imported bindings in different scopes', () => {
      const config = loadConfig(dedent`
        import { addons } from 'storybook/manager-api';

        addons.setConfig({ showNav: false });

        function configure() {
          const { addons } = require('storybook/manager-api');
          addons.setConfig({ showPanel: false });
        }
      `).parse();

      const calls = config.callArguments({
        importedName: 'addons',
        methodName: 'setConfig',
        moduleNames: ['storybook/manager-api'],
      });

      expect(calls).toHaveLength(2);
      expect(calls[0].getValue(['showNav'])).toBe(false);
      expect(calls[1].getValue(['showPanel'])).toBe(false);
    });

    it('ignores other bindings from the same CommonJS destructuring', () => {
      const config = loadConfig(dedent`
        const { addons, unrelated } = require('storybook/manager-api');

        addons.setConfig({ showNav: false });
        unrelated.setConfig({ showPanel: false });
      `).parse();

      const calls = config.callArguments({
        importedName: 'addons',
        methodName: 'setConfig',
        moduleNames: ['storybook/manager-api'],
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].getValue(['showNav'])).toBe(false);
    });
  });

  describe('getField', () => {
    describe('named exports', () => {
      it('missing export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export const foo = { builder: 'webpack5' }
            `
          )
        ).toBeUndefined();
      });
      it('missing field', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export const core = { foo: 'webpack5' }
            `
          )
        ).toBeUndefined();
      });
      it('computed key named like the field', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const builder = 'other';
            export const core = { [builder]: 'webpack5' }
            `
          )
        ).toBeUndefined();
      });
      it('found scalar', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export const core = { builder: 'webpack5' }
            `
          )
        ).toEqual('webpack5');
      });
      it('found object', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export const core = { builder: { name: 'webpack5' } }
            `
          )
        ).toEqual({ name: 'webpack5' });
      });
      it('variable ref export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const coreVar = { builder: 'webpack5' };
            export const core = coreVar;
            `
          )
        ).toEqual('webpack5');
      });
      it('variable export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const coreVar = { builder: 'webpack5' };
            export const core = coreVar;
            `
          )
        ).toEqual('webpack5');
      });
      it('resolves values through various TS satisfies/as syntaxes', () => {
        const syntaxes = [
          'const coreVar = { builder: "webpack5" } as const; export const core = coreVar satisfies any;',
          'const coreVar = { builder: "webpack5" } as const; export const core = coreVar as any;',
          'const coreVar = { builder: "webpack5" } as const satisfies Record<string, unknown>; export { coreVar as core };',
        ];

        for (const source of syntaxes) {
          expect(getField(['core', 'builder'], source)).toEqual('webpack5');
        }
      });
    });

    describe('module exports', () => {
      it('missing export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            module.exports = { foo: { builder: 'webpack5' } }
            `
          )
        ).toBeUndefined();
      });
      it('found scalar', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            module.exports = { core: { builder: 'webpack5' } }
            `
          )
        ).toEqual('webpack5');
      });
      it('variable ref export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const core = { builder: 'webpack5' };
            module.exports = { core };
            `
          )
        ).toEqual('webpack5');
      });
      it('variable rename', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const coreVar = { builder: 'webpack5' };
            module.exports = { core: coreVar };
            `
          )
        ).toEqual('webpack5');
      });
      it('variable exports', () => {
        expect(
          getField(
            ['stories'],
            dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';

              const config: StorybookConfig = {
                stories: [{ directory: '../src', titlePrefix: 'Demo' }],
              }
              module.exports = config;
            `
          )
        ).toEqual([{ directory: '../src', titlePrefix: 'Demo' }]);
      });
    });

    describe('default export', () => {
      it('missing export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export default { foo: { builder: 'webpack5' } }
            `
          )
        ).toBeUndefined();
      });
      it('found scalar', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            export default { core: { builder: 'webpack5' } }
            `
          )
        ).toEqual('webpack5');
      });
      it('variable ref export', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const core = { builder: 'webpack5' };
            export default { core };
            `
          )
        ).toEqual('webpack5');
      });
      it('variable rename', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            const coreVar = { builder: 'webpack5' };
            export default { core: coreVar };
            `
          )
        ).toEqual('webpack5');
      });
      it('variable exports', () => {
        expect(
          getField(
            ['stories'],
            dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';

              const config: StorybookConfig = {
                stories: [{ directory: '../src', titlePrefix: 'Demo' }],
              }
              export default config;
            `
          )
        ).toEqual([{ directory: '../src', titlePrefix: 'Demo' }]);
      });
      it('export specifier', () => {
        expect(
          getField(
            ['foo'],
            dedent`
              const foo = 'bar';
              export { foo };
            `
          )
        ).toEqual('bar');
      });
      it('export aliased specifier', () => {
        expect(
          getField(
            ['fooAlias'],
            dedent`
              const foo = 'bar';
              export { foo as fooAlias };
            `
          )
        ).toEqual('bar');
      });
    });

    describe('factory config', () => {
      it('parses correctly', () => {
        const source = dedent`
          import { definePreview } from '@storybook/react-vite';

          const config = definePreview({
            framework: 'foo',
          });
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNameFromPath(['framework'])).toEqual('foo');
      });
      it('found scalar', () => {
        expect(
          getField(
            ['core', 'builder'],
            dedent`
            import { definePreview } from '@storybook/react-vite';
            export const foo = definePreview({ core: { builder: 'webpack5' } });
            `
          )
        ).toEqual('webpack5');
      });
      it('tags', () => {
        expect(
          getField(
            ['tags'],
            dedent`
              import { definePreview } from '@storybook/react-vite';
              const parameters = {};
              export const config = definePreview({
                parameters,
                tags: ['test', 'vitest', '!a11ytest'],
              });
            `
          )
        ).toEqual(['test', 'vitest', '!a11ytest']);
      });
      it('parses correctly with .type<T>() chaining on export default', () => {
        const source = dedent`
          import { definePreview } from '@storybook/react-vite';

          export default definePreview({
            parameters: {
              foo: 'bar',
            },
          }).type<{
            parameters: {
              customParam?: string;
            };
          }>();
        `;
        const config = loadConfig(source).parse();
        expect(config.getValue(['parameters', 'foo'])).toEqual('bar');
      });
    });
  });

  describe('set', () => {
    it('writes a node read from the same file as its source', () => {
      const config = loadConfig(`export const a = { b: [1, 'two'] }; export const c = {};`).parse();
      config.set(['c', 'd'], config.getFieldNode(['a', 'b']) as CsfExpression);
      expect(printConfig(config).code).toBe(
        `export const a = { b: [1, 'two'] }; export const c = { d: [1, 'two'] };`
      );
    });

    it('copies a node from another file by its source', () => {
      const other = loadConfig(`export const a = 1;`).parse();
      const config = loadConfig(`export const c = {};`).parse();
      config.set(['c', 'd'], other.getFieldNode(['a']) as CsfExpression);
      expect(formatConfig(config)).toBe(`export const c = { d: 1 };`);
    });

    describe('named exports', () => {
      it('missing export', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export const addons = [];
            `
          )
        ).toMatchInlineSnapshot(`
          export const addons = [];
          export const core = { builder: "webpack5" };
        `);
      });
      it('missing field', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export const core = { foo: 'bar' };
            `
          )
        ).toMatchInlineSnapshot(`export const core = { foo: 'bar', builder: 'webpack5' };`);
      });
      it('found scalar', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export const core = { builder: 'webpack4' };
            `
          )
        ).toMatchInlineSnapshot(`export const core = { builder: 'webpack5' };`);
      });
      it('found top-level scalar', () => {
        expect(
          setField(
            ['foo'],
            'baz',
            dedent`
              export const foo = 'bar';
            `
          )
        ).toMatchInlineSnapshot(`export const foo = 'baz';`);
      });
      it('found object', () => {
        expect(
          setField(
            ['core', 'builder'],
            { name: 'webpack5' },
            dedent`
              export const core = { builder: { name: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export const core = { builder: { name: 'webpack5' } };`);
      });
      it('variable export', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
            const coreVar = { builder: 'webpack4' };
            export const core = coreVar;
            `
          )
        ).toMatchInlineSnapshot(`
          const coreVar = { builder: 'webpack5' };
          export const core = coreVar;
        `);
      });
    });

    describe('module exports', () => {
      it('missing export', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              module.exports = { addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { addons: [], core: { builder: "webpack5" } };`);
      });
      it('missing field', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              module.exports = { core: { foo: 'bar' }};
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { core: { foo: 'bar', builder: 'webpack5' }};`);
      });
      it('found scalar', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              module.exports = { core: { builder: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { core: { builder: 'webpack5' } };`);
      });
    });

    describe('default export', () => {
      it('missing export', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export default { addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`export default { addons: [], core: { builder: "webpack5" } };`);
      });
      it('missing field', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export default { core: { foo: 'bar' }};
            `
          )
        ).toMatchInlineSnapshot(`export default { core: { foo: 'bar', builder: 'webpack5' }};`);
      });
      it('found scalar', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              export default { core: { builder: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export default { core: { builder: 'webpack5' } };`);
      });
    });

    describe('quotes', () => {
      it('no quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', '')).toMatchInlineSnapshot(
          `export const foo = { bar: "baz" };`
        );
      });
      it('more single quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', 'b', "c"]`))
          .toMatchInlineSnapshot(`
            export const stories = ['a', 'b', "c"]
            export const foo = { bar: 'baz' };
          `);
      });
      it('more double quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', "b", "c"]`))
          .toMatchInlineSnapshot(`
            export const stories = ['a', "b", "c"]
            export const foo = { bar: "baz" };
          `);
      });
    });

    describe('export specifiers', () => {
      it('found object', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              const core = { builder: 'webpack4' };
              export { core };
            `
          )
        ).toMatchInlineSnapshot(`
          const core = { builder: 'webpack5' };
          export { core };
        `);
      });

      it('sets nested field in parameters variable', () => {
        expect(
          setField(
            ['parameters', 'a11y'],
            'todo',
            dedent`
              const parameters = { foo: 'bar' };
              const preview = {
                parameters,
              }
              export default preview;
            `
          )
        ).toMatchInlineSnapshot(`
          const parameters = { foo: 'bar', a11y: 'todo' };
          const preview = {
            parameters,
          }
          export default preview;
        `);
      });

      it('sets nested field when parameters exists as both variable and direct object', () => {
        expect(
          setField(
            ['parameters', 'a11y'],
            'todo',
            dedent`
              const parameters = { foo: 'bar' };
              const preview = {
                parameters: {},
              }
              export default preview;
            `
          )
        ).toMatchInlineSnapshot(`
          const parameters = { foo: 'bar' };
          const preview = {
            parameters: { a11y: 'todo' },
          }
          export default preview;
        `);
      });
    });

    describe('factory config', () => {
      it('missing export', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              import { definePreview } from '@storybook/react-vite';
              export const foo = definePreview({
                addons: [],
              });
            `
          )
        ).toMatchInlineSnapshot(`
          import { definePreview } from '@storybook/react-vite';
          export const foo = definePreview({
            addons: [],
            core: { builder: 'webpack5' },
          });
        `);
      });
      it('missing field', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              import { definePreview } from '@storybook/react-vite';
              export const foo = definePreview({
                core: { foo: 'bar' },
              });
            `
          )
        ).toMatchInlineSnapshot(`
          import { definePreview } from '@storybook/react-vite';
          export const foo = definePreview({
            core: { foo: 'bar', builder: 'webpack5' },
          });
        `);
      });
      it('found scalar', () => {
        expect(
          setField(
            ['core', 'builder'],
            'webpack5',
            dedent`
              import { definePreview } from '@storybook/react-vite';
              export const foo = definePreview({
                core: { builder: 'webpack4' },
              });
            `
          )
        ).toMatchInlineSnapshot(`
          import { definePreview } from '@storybook/react-vite';
          export const foo = definePreview({
            core: { builder: 'webpack5' },
          });
        `);
      });
    });
  });

  describe('element paths', () => {
    it('addresses the elements of a named export like those of a default export field', () => {
      const config = loadConfig("export const addons = ['a', 'b', 'c'];").parse();

      expect(config.getValue(['addons', 1])).toBe('b');
      expect(config.set(['addons', 0], 'x')).toEqual({ ok: true, changed: true });
      expect(config.remove(['addons', 1])).toEqual({ ok: true, changed: true });
      expect(printConfig(config).code).toBe("export const addons = ['x', 'c'];");
    });

    it('edits the elements of a constant that only the config refers to', () => {
      const single = loadConfig("const addons = ['a'];\nexport default { addons };").parse();

      expect(single.set(['addons', 0], 'x')).toEqual({ ok: true, changed: true });
      expect(printConfig(single).code).toBe("const addons = ['x'];\nexport default { addons };");

      const source = "const addons = ['a'];\nexport default { addons, other: addons };";
      const shared = loadConfig(source).parse();

      expect(shared.getValue(['addons', 0])).toBe('a');
      expect(shared.set(['addons', 0], 'x')).toMatchObject({
        ok: false,
        diagnostic: { code: 'unsupported-member', path: ['addons', 0] },
      });
      expect(printConfig(shared).code).toBe(source);
    });
  });

  describe('appendToArray', () => {
    it('missing export', () => {
      expect(
        appendToArray(
          ['addons'],
          'docs',
          dedent`
              export default { core: { builder: 'webpack5' } };
            `
        )
      ).toMatchInlineSnapshot(
        `export default { core: { builder: 'webpack5' }, addons: ['docs'] };`
      );
    });
    it('reports a field that holds a call, which append would add an argument to', () => {
      const source = "export default { addons: ['a'].filter(Boolean) };";
      const config = loadConfig(source).parse();

      expect(config.appendValueToArray(['addons'], 'b')).toMatchObject({
        ok: false,
        diagnostic: {
          code: 'unsupported-value',
          message: "Expected an array literal at 'addons', got 'CallExpression'",
        },
      });
      expect(config.removeEntryFromArray(['addons'], 'a')).toMatchObject({ ok: false });
      expect(printConfig(config).code).toBe(source);
    });

    it('refuses a call below a constant, and appends to an array there', () => {
      const source =
        "const opts = { list: ['a'].filter(Boolean) };\nexport default { framework: { options: opts } };";
      const config = loadConfig(source).parse();

      expect(config.appendValueToArray(['framework', 'options', 'list'], 'z')).toMatchObject({
        ok: false,
        diagnostic: {
          code: 'unsupported-value',
          message: "Expected an array literal at 'framework.options.list', got 'CallExpression'",
        },
      });
      expect(printConfig(config).code).toBe(source);
      expect(
        appendToArray(
          ['framework', 'options', 'list'],
          'z',
          "const opts = { list: ['a'] };\nexport default { framework: { options: opts } };"
        ).split('\n')[0]
      ).toBe("const opts = { list: ['a', 'z'] };");
    });

    it('appends to an array a constant holds', () => {
      expect(
        appendToArray(['addons'], 'b', "const addons = ['a'];\nexport default { addons };")
      ).toBe("const addons = ['a', 'b'];\nexport default { addons };");
    });

    it('reports a field that is not an array literal and leaves it as written', () => {
      const config = loadConfig(`export default { addons: 5 };`).parse();
      const result = config.appendValueToArray(['addons'], 'docs');

      expect(result).toEqual({
        ok: false,
        changed: false,
        diagnostic: expect.objectContaining({ code: 'unsupported-value', path: ['addons'] }),
      });
      expect(config.mutationDiagnostics).toHaveLength(1);
      expect(config.appendNodeToArray(['addons'], parseExpression('docs'))).toMatchObject({
        ok: false,
      });
      expect(config.changed).toBe(false);
      expect(printConfig(config).code).toBe(`export default { addons: 5 };`);
    });

    it.each([
      [
        'a local object',
        "const shared = { addons: ['a'] };\nexport default { ...shared };",
        ['addons'],
        "export default { ...shared, addons: [...(shared.addons ?? []), 'x'] };",
      ],
      [
        'an import, through a missing parent',
        "import shared from './shared';\nexport default { ...shared };",
        ['framework', 'addons'],
        "export default { ...shared, framework: { ...shared.framework, addons: [...(shared.framework?.addons ?? []), 'x'] } };",
      ],
    ])(
      'creates a missing array after a spread of %s, carrying its elements forward',
      (_case, code, path, line) => {
        const viaValue = loadConfig(code).parse();
        expect(viaValue.appendValueToArray(path, 'x')).toEqual({ ok: true, changed: true });
        expect(printConfig(viaValue).code.split('\n').at(-1)).toBe(line);

        const viaNode = loadConfig(code).parse();
        expect(viaNode.appendNodeToArray(path, parseExpression("'x'"))).toEqual({
          ok: true,
          changed: true,
        });
        expect(printConfig(viaNode).code).toBe(printConfig(viaValue).code);
      }
    );

    it.each([
      ['a spread of a call', 'export default { ...getShared() };', 'spread-field'],
      [
        'spreads of two imports, either of which may provide it',
        "import a from './a';\nimport b from './b';\nexport default { ...a, ...b };",
        'spread-field',
      ],
      ['a computed key, which may name it', 'export default { [key]: [] };', 'dynamic-key'],
    ])('rejects creating an array after %s', (_case, source, code) => {
      const config = loadConfig(source).parse();

      expect(config.appendValueToArray(['addons'], 'x')).toMatchObject({
        ok: false,
        diagnostic: { code },
      });
      expect(printConfig(config).code).toBe(source);
    });

    it('reports a change like the other mutations', () => {
      const config = loadConfig(`export default { addons: [] };`).parse();

      expect(config.appendValueToArray(['addons'], 'docs')).toEqual({ ok: true, changed: true });
      expect(config.changed).toBe(true);
    });
    it('array of simple values', () => {
      expect(
        appendToArray(
          ['addons'],
          'docs',
          dedent`
              export default { addons: ['a11y', 'viewport'] };
            `
        )
      ).toMatchInlineSnapshot(`export default { addons: ['a11y', 'viewport', 'docs'] };`);
    });

    it('array of complex values', () => {
      expect(
        appendToArray(
          ['addons'],
          'docs',
          dedent`
              export default { addons: [require.resolve('a11y'), someVariable] };
            `
        )
      ).toMatchInlineSnapshot(
        `export default { addons: [require.resolve('a11y'), someVariable, 'docs'] };`
      );
    });

    it('appends after a parenthesized element with a comment inside', () => {
      expect(
        appendToArray(['addons'], 'b', `export default { addons: [(/* c */ cond ? 'a' : 'c')] };`)
      ).toBe(`export default { addons: [(/* c */ cond ? 'a' : 'c'), 'b'] };`);
    });

    it.each([
      {
        source: `export default { addons: ['b'] };`,
        expression: 'x, y',
        output: `export default { addons: ['b', (x, y)] };`,
      },
      {
        source: `export default { addons: ['b'] };`,
        expression: `'x' //c`,
        output: `export default { addons: [\n  'b',\n  'x' //c\n] };`,
      },
      {
        source: `export default {};`,
        expression: 'x, y',
        output: `export default { addons: [(x, y)] };`,
      },
      {
        source: `export default {};`,
        expression: `'x' //c`,
        output: `export default {\n  addons: ['x' //c\n  ],\n};`,
      },
    ])('appends $expression as one element to $source', ({ source, expression, output }) => {
      const config = loadConfig(source).parse();
      config.appendNodeToArray(['addons'], parseExpression(expression));

      expect(printConfig(config).code).toBe(output);
    });

    it('re-indents a multi-line node from its own line, at the indent of the array', () => {
      const source = 'export default {\n  a: [\n    [\n      1,\n    ],\n  ],\n  list: [],\n};';
      const output =
        'export default {\n  a: [\n    [\n      1,\n    ],\n  ],\n  list: [\n    [\n      1,\n    ],\n  ],\n};';
      const config = loadConfig(source).parse();
      const array = config.get(['a']);
      expect(array?.type).toBe('ArrayExpression');
      const child = array?.type === 'ArrayExpression' ? array.elements[0] : undefined;

      expect(config.appendNodeToArray(['list'], child as CsfExpression)).toEqual({
        ok: true,
        changed: true,
      });
      expect(printConfig(config).code).toBe(output);
    });
  });

  it('removes a field of a multi-declarator export through remove, keeping its siblings', () => {
    const config = loadConfig("export const framework = 'x', a = 1;").parse();

    expect('removeField' in config).toBe(false);
    expect(config.remove(['framework'])).toEqual({ ok: true, changed: true });
    expect(printConfig(config).code).toBe('export const a = 1;');
  });

  describe('config helpers', () => {
    describe('getNameFromPath', () => {
      it(`supports string literal node`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = {
            framework: 'foo',
          }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNameFromPath(['framework'])).toEqual('foo');
      });

      describe('satisfies', () => {
        it(`supports string literal node`, () => {
          const source = dedent`
            import type { StorybookConfig } from '@storybook/react-webpack5';
  
            const config = {
              framework: 'foo',
            } satisfies StorybookConfig
            export default config;
          `;
          const config = loadConfig(source).parse();
          expect(config.getNameFromPath(['framework'])).toEqual('foo');
        });

        it(`supports string literal node without variables`, () => {
          const source = dedent`
            import type { StorybookConfig } from '@storybook/react-webpack5';
  
            export default {
              framework: 'foo',
            } satisfies StorybookConfig;
          `;
          const config = loadConfig(source).parse();
          expect(config.getNameFromPath(['framework'])).toEqual('foo');
        });

        it(`supports object expression node with name property`, () => {
          const source = dedent`
            import type { StorybookConfig } from '@storybook/react-webpack5';
  
            const config = {
              framework: { name: 'foo', options: { bar: require('baz') } },
              "otherField": { "name": 'foo', options: { bar: require('baz') } },
            } satisfies StorybookConfig
            export default config;
          `;
          const config = loadConfig(source).parse();
          expect(config.getNameFromPath(['framework'])).toEqual('foo');
          expect(config.getNameFromPath(['otherField'])).toEqual('foo');
        });
      });

      it(`supports object expression node with name property`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = {
            framework: { name: 'foo', options: { bar: require('baz') } },
            "otherField": { "name": 'foo', options: { bar: require('baz') } },
          }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNameFromPath(['framework'])).toEqual('foo');
        expect(config.getNameFromPath(['otherField'])).toEqual('foo');
      });

      it(`supports wrapped names`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = {
            framework: getAbsolutePath('foo'),
          }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNameFromPath(['framework'])).toEqual('foo');
      });

      it(`returns undefined when accessing a field that does not exist`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = { }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNameFromPath(['framework'])).toBeUndefined();
      });

      it(`throws an error when node is of unexpected type`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = {
            framework: makesNoSense(),
          }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(() => config.getNameFromPath(['framework'])).toThrowError(
          `The given node must be a string literal or an object expression with a "name" property that is a string literal.`
        );
      });
    });

    describe('getNamesFromPath', () => {
      it(`supports an array with string literal and object expression with name property`, () => {
        const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';

          const config: StorybookConfig = {
            addons: [
              'foo',
              { name: 'bar', options: {} },
            ],
            "otherField": [
              "foo",
              { "name": 'bar', options: {} },
            ],
          }
          export default config;
        `;
        const config = loadConfig(source).parse();
        expect(config.getNamesFromPath(['addons'])).toEqual(['foo', 'bar']);
        expect(config.getNamesFromPath(['otherField'])).toEqual(['foo', 'bar']);
      });

      describe('satisfies', () => {
        describe('default export', () => {
          it(`supports an array with string literal and object expression with name property`, () => {
            const source = dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';
    
              const config = {
                addons: [
                  'foo',
                  { name: 'bar', options: {} },
                ],
                "otherField": [
                  "foo",
                  { "name": 'bar', options: {} },
                ],
              } satisfies StorybookConfig
              export default config;
            `;
            const config = loadConfig(source).parse();
            expect(config.getNamesFromPath(['addons'])).toEqual(['foo', 'bar']);
            expect(config.getNamesFromPath(['otherField'])).toEqual(['foo', 'bar']);
          });

          it(`supports an array with string literal and object expression with name property without variable`, () => {
            const source = dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';
    
              export default {
                addons: [
                  'foo',
                  { name: 'bar', options: {} },
                ],
                "otherField": [
                  "foo",
                  { "name": 'bar', options: {} },
                ],
              } satisfies StorybookConfig;
            `;
            const config = loadConfig(source).parse();
            expect(config.getNamesFromPath(['addons'])).toEqual(['foo', 'bar']);
            expect(config.getNamesFromPath(['otherField'])).toEqual(['foo', 'bar']);
          });
        });

        describe('module exports', () => {
          it(`supports an array with string literal and object expression with name property`, () => {
            const source = dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';
    
              const config = {
                addons: [
                  'foo',
                  { name: 'bar', options: {} },
                ],
                "otherField": [
                  "foo",
                  { "name": 'bar', options: {} },
                ],
              } satisfies StorybookConfig
              module.exports = config;
            `;
            const config = loadConfig(source).parse();
            expect(config.getNamesFromPath(['addons'])).toEqual(['foo', 'bar']);
            expect(config.getNamesFromPath(['otherField'])).toEqual(['foo', 'bar']);
          });

          it(`supports an array with string literal and object expression with name property without variable`, () => {
            const source = dedent`
              import type { StorybookConfig } from '@storybook/react-webpack5';
    
              module.exports = {
                addons: [
                  'foo',
                  { name: 'bar', options: {} },
                ],
                "otherField": [
                  "foo",
                  { "name": 'bar', options: {} },
                ],
              } satisfies StorybookConfig;
            `;
            const config = loadConfig(source).parse();
            expect(config.getNamesFromPath(['addons'])).toEqual(['foo', 'bar']);
            expect(config.getNamesFromPath(['otherField'])).toEqual(['foo', 'bar']);
          });
        });
      });
    });

    it(`returns undefined when accessing a field that does not exist`, () => {
      const source = dedent`
        import type { StorybookConfig } from '@storybook/react-webpack5';

        const config: StorybookConfig = { }
        export default config;
      `;
      const config = loadConfig(source).parse();
      expect(config.getNamesFromPath(['addons'])).toBeUndefined();
    });
  });

  describe('setImport', () => {
    it('imports a repeated name once', () => {
      const config = loadConfig(`export default {};`).parse();
      config.setImport(['a', 'a'], 'x');
      config.setImport(['a', 'b', 'b'], 'x');

      expect(formatConfig(config)).toBe(`import { a, b } from "x";\nexport default {};`);
    });

    it('keeps a license header above the imports it adds', () => {
      const source = dedent`
        /*
         * Copyright Example
         */

        import type { StorybookConfig } from '@storybook/react-vite';

        const config: StorybookConfig = { stories: [] };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport(['dirname'], 'node:path');
      config.setImport(['fileURLToPath'], 'node:url');

      expect(formatConfig(config)).toMatchInlineSnapshot(`
        /*
         * Copyright Example
         */

        import type { StorybookConfig } from '@storybook/react-vite';
        import { dirname } from 'node:path';
        import { fileURLToPath } from 'node:url';

        const config: StorybookConfig = { stories: [] };
        export default config;
      `);
    });

    it('adds an import below the comment trailing the last import under a license header', () => {
      const config = loadConfig(
        `// Copyright Example\nimport a from 'a'; // a\nexport default {};`
      ).parse();
      config.setImport(['b'], 'b');

      expect(printConfig(config).code).toBe(
        `// Copyright Example\nimport a from 'a'; // a\nimport { b } from 'b';\nexport default {};`
      );
    });

    it('keeps a directive on its statement when moving the license header', () => {
      const source = dedent`
        // Copyright Example

        // @ts-expect-error not a number
        const config: number = {};
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport(['dirname'], 'node:path');

      expect(formatConfig(config)).toMatchInlineSnapshot(`
        // Copyright Example

        import { dirname } from "node:path";
        // @ts-expect-error not a number
        const config: number = {};
        export default config;
      `);
    });

    it('keeps a license header above a require it adds to a file without imports', () => {
      const source = dedent`
        // Copyright Example

        module.exports = { stories: [] };
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport(['dirname'], 'node:path');

      expect(formatConfig(config)).toMatchInlineSnapshot(`
        // Copyright Example

        const { dirname } = require("node:path");
        module.exports = { stories: [] };
      `);
    });

    it(`supports setting a default import for a field that does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import path from "path";
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`uses the existing node import when using node:xyz paths but the package xyz is already imported`, () => {
      const source = dedent`
        import { join } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport(['dirname'], 'node:path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { join, dirname } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a default import for a field that does exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import path from "path";
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a named import for a field that does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { dirname } from "path";
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a named import for a field where the source already exists`, () => {
      const source = dedent`
        import { dirname } from 'path';

        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { dirname } from 'path';

        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it.each([
      {
        source: `import { /* A */ a } from 'x';`,
        specifier: ['b'],
        output: `import { /* A */ a, b } from 'x';`,
      },
      {
        source: `import { /* A */ a } from 'x';`,
        specifier: 'd',
        output: `import d, { /* A */ a } from 'x';`,
      },
      {
        source: `import { a } from 'x';`,
        specifier: { namespace: 'ns' },
        output: `import { a } from 'x';\nimport * as ns from 'x';`,
      },
      {
        source: `import 'x';\nimport 'y';`,
        specifier: { namespace: 'ns' },
        output: `import 'x';\nimport * as ns from 'x';\nimport 'y';`,
      },
      {
        source: `import * as ns from 'x';`,
        specifier: ['a'],
        output: `import * as ns from 'x';\nimport { a } from 'x';`,
      },
      {
        source: `import * as ns from 'x'; // why`,
        specifier: ['a'],
        output: `import * as ns from 'x'; // why\nimport { a } from 'x';`,
      },
      {
        source: `import * as ns from 'x'; /* a */ // why`,
        specifier: ['a'],
        output: `import * as ns from 'x'; /* a */ // why\nimport { a } from 'x';`,
      },
      {
        source: `import foo from 'x';`,
        specifier: 'bar',
        output: `import foo from 'x';\nimport bar from 'x';`,
      },
    ])('adds $specifier to $source', ({ source, specifier, output }) => {
      const config = loadConfig(source).parse();
      config.setImport(specifier, 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it.each([
      {
        source: `import type { A } from 'x';\nexport default {};`,
        specifier: ['b'],
        output: `import type { A } from 'x';\nimport { b } from 'x';\nexport default {};`,
      },
      {
        source: `import type A from 'x';`,
        specifier: 'b',
        output: `import type A from 'x';\nimport b from 'x';`,
      },
      {
        source: `import type { A } from 'x';\nimport { b } from 'x';`,
        specifier: ['c'],
        output: `import type { A } from 'x';\nimport { b, c } from 'x';`,
      },
      {
        source: `import * as ns from 'x';\nimport { a } from 'x';`,
        specifier: ['a', 'b'],
        output: `import * as ns from 'x';\nimport { a, b } from 'x';`,
      },
      {
        source: `import { a } from 'x';\nimport d from 'x';`,
        specifier: 'd',
        output: `import { a } from 'x';\nimport d from 'x';`,
      },
    ])('adds value specifiers $specifier to $source', ({ source, specifier, output }) => {
      const config = loadConfig(source).parse();
      config.setImport(specifier, 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it.each([
      { source: ``, output: `import { a as b } from "x";\n` },
      { source: `import { a } from 'x';`, output: `import { a, a as b } from 'x';` },
      { source: `import { a as b } from 'x';`, output: `import { a as b } from 'x';` },
    ])('adds the alias `a as b` to $source', ({ source, output }) => {
      const config = loadConfig(source).parse();
      config.setImport(['a as b'], 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it.each([
      {
        source: `import type { A } from 'x';\nexport default {};`,
        specifier: ['A'],
        output: `import { A } from 'x';\nexport default {};`,
      },
      {
        source: `import { type A, b } from 'x';`,
        specifier: ['A'],
        output: `import { b, A } from 'x';`,
      },
      {
        source: `import type { A as B, C } from 'x';`,
        specifier: ['A as B'],
        output: `import type { C } from 'x';\nimport { A as B } from 'x';`,
      },
      {
        source: `import type A from 'x';\nexport default {};`,
        specifier: 'A',
        output: `import A from 'x';\nexport default {};`,
      },
    ])(
      'turns the type-only binding of $specifier in $source into a value import',
      ({ source, specifier, output }) => {
        const config = loadConfig(source).parse();
        config.setImport(specifier, 'x');

        expect(printConfig(config).code).toBe(output);
      }
    );

    it.each(['a-b', 'a as b as c', ''])('rejects the import name %j', (name) => {
      const config = loadConfig('').parse();

      expect(() => config.setImport([name], 'x')).toThrow('import name');
    });

    it('adds a name that the file only imports under an alias', () => {
      const config = loadConfig(`import { a as b } from 'x';`).parse();
      config.setImport(['a'], 'x');

      expect(printConfig(config).code).toBe(`import { a as b, a } from 'x';`);
    });

    it('ends the statements it adds like the file does', () => {
      const config = loadConfig(`import a from 'a'\nexport default {}\n`).parse();
      config.setImport(['b'], 'b');
      config.setImport(null, 'c');

      expect(printConfig(config).code).toBe(
        `import a from 'a'\nimport { b } from 'b'\nimport 'c'\nexport default {}\n`
      );
    });

    it(`supports setting a namespaced import`, () => {
      const config = loadConfig('').parse();
      config.setImport({ namespace: 'path' }, 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`import * as path from "path";`);
    });

    it(`supports setting import without specifier`, () => {
      const config = loadConfig('').parse();
      config.setImport(null, 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`import "path";`);
    });
  });

  describe('setRequireImport', () => {
    it(`supports setting a default import for a field that does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const path = require("path");
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a default import for a field that does exist`, () => {
      const source = dedent`
        const path = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const path = require('path');
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a named import for a field that does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { dirname } = require("path");
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a named import for a field where the source already exists`, () => {
      const source = dedent`
        const { dirname } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport(['dirname', 'basename'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { dirname, basename } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it.each([
      {
        source: `module.exports = {};`,
        output: `const { a } = require("x");\nmodule.exports = {};`,
      },
      {
        source: `const { b } = require('x');`,
        output: `const { b, a } = require('x');`,
      },
    ])('adds a repeated name once to $source', ({ source, output }) => {
      const config = loadConfig(source).parse();
      config.setRequireImport(['a', 'a'], 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it.each([
      {
        source: `const a = require('x');`,
        specifier: ['b'],
        output: `const { b } = require('x');\nconst a = require('x');`,
      },
      {
        source: `const a = require('x');\nconst { b } = require('x');`,
        specifier: ['c'],
        output: `const a = require('x');\nconst { b, c } = require('x');`,
      },
      {
        source: `const { b } = require('x');\nconst a = require('x');`,
        specifier: 'a',
        output: `const { b } = require('x');\nconst a = require('x');`,
      },
      {
        source: `const { b } = require('x');`,
        specifier: ['a as c', 'b'],
        output: `const { b, a: c } = require('x');`,
      },
      {
        source: `const { a: c } = require('x');`,
        specifier: ['a as c', 'a'],
        output: `const { a: c, a } = require('x');`,
      },
      {
        source: `const { a = 1, b: c = 2 } = require('x');`,
        specifier: ['a', 'b as c'],
        output: `const { a = 1, b: c = 2 } = require('x');`,
      },
      {
        source: `module.exports = {}`,
        specifier: 'a',
        output: `const a = require("x")\nmodule.exports = {}`,
      },
    ])('adds $specifier to $source', ({ source, specifier, output }) => {
      const config = loadConfig(source).parse();
      config.setRequireImport(specifier, 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it(`supports setting a named import for a field where the source already exists without "node:" prefix`, () => {
      const source = dedent`
        const { dirname } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport(['dirname', 'basename'], 'node:path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { dirname, basename } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `);
    });
  });

  describe('removeImport', () => {
    it(`removes a default require import`, () => {
      const source = dedent`
        const path = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes a default ES6 import`, () => {
      const source = dedent`
        import path from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes a named require import`, () => {
      const source = dedent`
        const { dirname, basename } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { basename } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes a named ES6 import`, () => {
      const source = dedent`
        import { dirname, basename } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { basename } from 'path';
        const config: StorybookConfig = { };
        export default config;
        `);
    });

    it(`removes multiple named require imports`, () => {
      const source = dedent`
        const { dirname, basename, join } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname', 'basename'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { join } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes multiple named ES6 imports`, () => {
      const source = dedent`
        import { dirname, basename, join } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname', 'basename'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { join } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`keeps the comments of the remaining specifiers`, () => {
      const config = loadConfig(`import { /* A */ a, /* B */ b, /* C */ c } from 'x';`).parse();
      config.removeImport(['b'], 'x');

      expect(printConfig(config).code).toBe(`import { /* A */ a, /* C */ c } from 'x';`);
    });

    it(`removes a namespace ES6 import`, () => {
      const source = dedent`
        import * as path from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;
      const config = loadConfig(source).parse();
      config.removeImport({ namespace: 'path' }, 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`preserves default import when removing a namespace ES6 import`, () => {
      const source = dedent`
        import path, * as alsoPath from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;
      const config = loadConfig(source).parse();
      config.removeImport({ namespace: 'alsoPath' }, 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import path from 'path';
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes entire require declaration when all named imports are removed`, () => {
      const source = dedent`
        const { dirname, basename } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname', 'basename'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes entire ES6 declaration when all named imports are removed`, () => {
      const source = dedent`
        import { dirname, basename } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname', 'basename'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`handles node: prefix in require imports`, () => {
      const source = dedent`
        const { dirname } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname'], 'node:path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`handles node: prefix in ES6 imports`, () => {
      const source = dedent`
        import { dirname } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname'], 'node:path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`does nothing when require import does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport('path', 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(source);
    });

    it(`does nothing when trying to remove non-existent named require import`, () => {
      const source = dedent`
        const { dirname } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['nonexistent'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(source);
    });

    it(`does nothing when trying to remove non-existent named ES6 import`, () => {
      const source = dedent`
        import { dirname } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['nonexistent'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(source);
    });

    it.each([
      {
        source: `import type { A } from 'x';\nimport { b } from 'x';\nimport { c, d } from 'x';`,
        specifier: ['A', 'c'],
        output: `import type { A } from 'x';\nimport { b } from 'x';\nimport { d } from 'x';`,
      },
      {
        source: `import { a as b, a } from 'x';`,
        specifier: ['a as b'],
        output: `import { a } from 'x';`,
      },
      {
        source: `import { a as b } from 'x';\nimport { a } from 'x';`,
        specifier: ['a'],
        output: ``,
      },
      {
        source: `import 'x';\nimport { a } from 'x';\nimport 'x';`,
        specifier: null,
        output: `import { a } from 'x';\n`,
      },
      {
        source: `const a = require('x');\nconst { b, c } = require('x');`,
        specifier: ['b'],
        output: `const a = require('x');\nconst { c } = require('x');`,
      },
      {
        source: `const { a: b = 1, c } = require('x');`,
        specifier: ['a as b'],
        output: `const { c } = require('x');`,
      },
    ])('removes $specifier from $source', ({ source, specifier, output }) => {
      const config = loadConfig(source).parse();
      config.removeImport(specifier, 'x');

      expect(printConfig(config).code).toBe(output);
    });

    it(`removes ES6 import while preserving require import`, () => {
      const source = dedent`
        import { readFile } from 'fs';
        const { dirname } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['readFile'], 'fs');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        const { dirname } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes require import while preserving ES6 import`, () => {
      const source = dedent`
        import { readFile } from 'fs';
        const { dirname } = require('path');
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.removeImport(['dirname'], 'path');

      const parsed = printConfig(config).code;

      expect(parsed).toMatchInlineSnapshot(`
        import { readFile } from 'fs';
        const config: StorybookConfig = { };
        export default config;
      `);
    });
  });

  describe('removeEntryFromArray', () => {
    it('removes a string literal entry', () => {
      const source = dedent`
        export default {
          addons: ['a', 'b', 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a preset-style object entry', () => {
      const source = dedent`
        export default {
          addons: ['a', { name: 'b', options: {} }, 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a wrapped string entry', () => {
      const source = dedent`
        export default {
          addons: ['a', getAbsolutePath('b'), 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a wrapped object entry', () => {
      const source = dedent`
        export default {
          addons: ['a',  { name: getAbsolutePath('b'), options: {} }, 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes the entry after a parenthesized element with a comment inside', () => {
      const config = loadConfig(
        `export default { addons: [(/* c */ cond ? 'a' : 'c'), 'b'] };`
      ).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(printConfig(config).code).toBe(
        `export default { addons: [(/* c */ cond ? 'a' : 'c')] };`
      );
    });

    it('leaves an array without the entry unchanged, like a missing field', () => {
      const config = loadConfig(`export default { addons: ['a'] };`).parse();

      expect(config.removeEntryFromArray(['addons'], 'x')).toEqual({ ok: true, changed: false });
      expect(config.removeEntryFromArray(['stories'], 'x')).toEqual({ ok: true, changed: false });
      expect(config.removeEntryFromArray(['addons'], 'a')).toEqual({ ok: true, changed: true });
      expect(config.changed).toBe(true);
    });

    it.each([
      [
        'a constant',
        "const addons = ['a', 'b'];\nexport default { addons };",
        "const addons = ['a'];",
      ],
      [
        'an `as const` export',
        "export const addons = ['a', 'b'] as const;",
        "export const addons = ['a'] as const;",
      ],
      [
        'an export of a constant',
        "const list = ['a', 'b'];\nexport const addons = list;",
        "const list = ['a'];",
      ],
    ])('removes an entry of the array %s holds', (_case, source, line) => {
      const config = loadConfig(source).parse();

      expect(config.removeEntryFromArray(['addons'], 'b')).toEqual({ ok: true, changed: true });
      expect(printConfig(config).code.split('\n')[0]).toBe(line);
    });

    it('reports an array a later spread could replace, like append', () => {
      const source = "export default { addons: ['a'], ...base };";
      const config = loadConfig(source).parse();

      expect(config.removeEntryFromArray(['addons'], 'a')).toMatchObject({
        ok: false,
        diagnostic: { code: 'spread-field', path: ['addons'] },
      });
      expect(config.appendValueToArray(['addons'], 'b')).toMatchObject({
        diagnostic: { code: 'spread-field' },
      });
      expect(printConfig(config).code).toBe(source);
    });

    it('reports a field that is not an array literal', () => {
      const config = loadConfig(`export default { addons: {} };`).parse();
      const result = config.removeEntryFromArray(['addons'], 'x');

      expect(result).toEqual({
        ok: false,
        changed: false,
        diagnostic: expect.objectContaining({ code: 'unsupported-value', path: ['addons'] }),
      });
      expect(config.mutationDiagnostics).toHaveLength(1);
    });
  });

  describe('parse', () => {
    it.each(['export { Missing };', 'export type { Missing };'])(
      'rejects %s of a name the file never declares',
      (exported) => {
        expect(() => loadConfig(`export default {};\n${exported}`, 'main.ts').parse()).toThrow(
          /^Export 'Missing' is not defined \(2:\d+\) in main\.ts$/
        );
      }
    );

    it.each(['const X = 1;', 'type X = {};', 'import { X } from "x";'])(
      'accepts export { X } after %s',
      (declaration) => {
        expect(() => loadConfig(`${declaration}\nexport { X };`, 'main.ts').parse()).not.toThrow();
      }
    );

    it("export { X } with X is import { X } from 'another-file'", () => {
      const source = dedent`
          import type { StorybookConfig } from '@storybook/react-webpack5';
          import { path } from 'path';

          export { path };

          const config: StorybookConfig = {
            addons: [
              'foo',
              { name: 'bar', options: {} },
            ],
            "otherField": [
              "foo",
              { "name": 'bar', options: {} },
            ],
          }
          export default config;
        `;
      const config = loadConfig(source).parse();

      expect(config._exportDecls['path']).toBe(undefined);
      expect(config._exports['path']).toBe(undefined);
    });

    it('detects const and function export declarations', () => {
      const source = dedent`
        export function normalFunction() { };
        export const value = ['@storybook/addon-essentials'];
        export async function asyncFunction() { };
        `;
      const config = loadConfig(source).parse();

      expect(Object.keys(config._exportDecls)).toHaveLength(3);
    });

    it('detects exports object on various TS satisfies/as export syntaxes', () => {
      const syntaxes = [
        'const config = { framework: "foo" }; export default config;',
        'const config = { framework: "foo" }; export default config satisfies StorybookConfig;',
        'const config = { framework: "foo" }; export default config as StorybookConfig;',
        'const config = { framework: "foo" }; export default config as unknown as StorybookConfig;',
        'export default { framework: "foo" };',
        'export default { framework: "foo" } satisfies StorybookConfig;',
        'export default { framework: "foo" } as StorybookConfig;',
        'export default { framework: "foo" } as unknown as StorybookConfig;',
      ];
      for (const source of syntaxes) {
        const config = loadConfig(source).parse();
        expect(config._exportsObject?.type).toBe('ObjectExpression');
        expect(config._exportsObject?.properties).toHaveLength(1);
      }
    });
  });
});
