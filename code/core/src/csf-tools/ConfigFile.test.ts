import { describe, expect, it } from 'vitest';

import { babelPrint } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadConfig, printConfig } from './ConfigFile';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: (val) => true,
});

const getField = (path: string[], source: string) => {
  const config = loadConfig(source).parse();
  return config.getFieldValue(path);
};

const setField = (path: string[], value: any, source: string) => {
  const config = loadConfig(source).parse();
  config.setFieldValue(path, value);
  return printConfig(config).code;
};

const appendToArray = (path: string[], value: any, source: string) => {
  const config = loadConfig(source).parse();
  config.appendValueToArray(path, value);
  return printConfig(config).code;
};

const removeField = (path: string[], source: string) => {
  const config = loadConfig(source).parse();
  config.removeField(path);
  return printConfig(config).code;
};

describe('ConfigFile', () => {
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
    });
  });

  describe('setField', () => {
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

          export const core = {
            builder: "webpack5"
          };
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
        ).toMatchInlineSnapshot(`
          export const core = {
            foo: 'bar',
            builder: 'webpack5'
          };
        `);
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
        ).toMatchInlineSnapshot(`
          export const core = { builder: {
            name: 'webpack5'
          } };
        `);
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
        ).toMatchInlineSnapshot(`
          module.exports = {
            addons: [],

            core: {
              builder: "webpack5"
            }
          };
        `);
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
        ).toMatchInlineSnapshot(`
          module.exports = { core: {
            foo: 'bar',
            builder: 'webpack5'
          }};
        `);
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
        ).toMatchInlineSnapshot(`
          export default {
            addons: [],

            core: {
              builder: "webpack5"
            }
          };
        `);
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
        ).toMatchInlineSnapshot(`
          export default { core: {
            foo: 'bar',
            builder: 'webpack5'
          }};
        `);
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
        expect(setField(['foo', 'bar'], 'baz', '')).toMatchInlineSnapshot(`
          export const foo = {
            bar: "baz"
          };
        `);
      });
      it('more single quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', 'b', "c"]`))
          .toMatchInlineSnapshot(`
          export const stories = ['a', 'b', "c"]

          export const foo = {
            bar: 'baz'
          };
        `);
      });
      it('more double quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', "b", "c"]`))
          .toMatchInlineSnapshot(`
          export const stories = ['a', "b", "c"]

          export const foo = {
            bar: "baz"
          };
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
          const parameters = {
            foo: 'bar',
            a11y: 'todo'
          };
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
            parameters: {
              a11y: 'todo'
            },
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

            core: {
              builder: 'webpack5'
            }
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
            core: {
              foo: 'bar',
              builder: 'webpack5'
            },
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
      ).toMatchInlineSnapshot(`
        export default {
          core: { builder: 'webpack5' },
          addons: ['docs']
        };
      `);
    });
    it('found scalar', () => {
      expect(() =>
        appendToArray(
          ['addons'],
          'docs',
          dedent`
              export default { addons: 5 };
            `
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `Error: Expected array at 'addons', got 'NumericLiteral'`
      );
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
  });

  describe('removeField', () => {
    describe('named exports', () => {
      it('missing export', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export const addons = [];
            `
          )
        ).toMatchInlineSnapshot(`export const addons = [];`);
      });
      it('missing field', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export const core = { foo: 'bar' };
            `
          )
        ).toMatchInlineSnapshot(`export const core = { foo: 'bar' };`);
      });
      it('found scalar', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export const core = { builder: 'webpack4' };
            `
          )
        ).toMatchInlineSnapshot(`export const core = {};`);
      });
      it('found object', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export const core = { builder: { name: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export const core = {};`);
      });
      it('nested object', () => {
        expect(
          removeField(
            ['core', 'builder', 'name'],
            dedent`
              export const core = { builder: { name: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export const core = { builder: {} };`);
      });
      it('string literal key', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export const core = { 'builder': 'webpack4' };
            `
          )
        ).toMatchInlineSnapshot(`export const core = {};`);
      });
      it('variable export', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
            const coreVar = { builder: 'webpack4' };
            export const core = coreVar;
            `
          )
        ).toMatchInlineSnapshot(`
          const coreVar = {};
          export const core = coreVar;
        `);
      });
      it('root export variable', () => {
        expect(
          removeField(
            ['core'],
            dedent`
              export const core = { builder: { name: 'webpack4' } };

              export const addons = [];
            `
          )
        ).toMatchInlineSnapshot(`export const addons = [];`);
      });
    });

    describe('module exports', () => {
      it('missing export', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              module.exports = { addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { addons: [] };`);
      });
      it('missing field', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              module.exports = { core: { foo: 'bar' }};
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { core: { foo: 'bar' }};`);
      });
      it('found scalar', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              module.exports = { core: { builder: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { core: {} };`);
      });
      it('nested scalar', () => {
        expect(
          removeField(
            ['core', 'builder', 'name'],
            dedent`
              module.exports = { core: { builder: { name: 'webpack4' } } };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { core: { builder: {} } };`);
      });
      it('string literal key', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              module.exports = { 'core': { 'builder': 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`module.exports = { 'core': {} };`);
      });
      it('root property', () => {
        expect(
          removeField(
            ['core'],
            dedent`
              module.exports = { core: { builder: { name: 'webpack4' } }, addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`
          module.exports = {
            addons: []
          };
        `);
      });
    });

    describe('default export', () => {
      it('missing export', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export default { addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`export default { addons: [] };`);
      });
      it('missing field', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export default { core: { foo: 'bar' }};
            `
          )
        ).toMatchInlineSnapshot(`export default { core: { foo: 'bar' }};`);
      });
      it('found scalar', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export default { core: { builder: 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export default { core: {} };`);
      });
      it('nested scalar', () => {
        expect(
          removeField(
            ['core', 'builder', 'name'],
            dedent`
              export default { core: { builder: { name: 'webpack4' } } };
            `
          )
        ).toMatchInlineSnapshot(`export default { core: { builder: {} } };`);
      });
      it('string literal key', () => {
        expect(
          removeField(
            ['core', 'builder'],
            dedent`
              export default { 'core': { 'builder': 'webpack4' } };
            `
          )
        ).toMatchInlineSnapshot(`export default { 'core': {} };`);
      });
      it('root property', () => {
        expect(
          removeField(
            ['core'],
            dedent`
              export default { core: { builder: { name: 'webpack4' } }, addons: [] };
            `
          )
        ).toMatchInlineSnapshot(`
          export default {
            addons: []
          };
        `);
      });
      it('root globals as variable', () => {
        expect(
          removeField(
            ['globals'],
            dedent`
              const preview = { globals: { a: 1 }, bar: { a: 1 } };
              export default preview;
            `
          )
        ).toMatchInlineSnapshot(`
          const preview = {
            bar: { a: 1 }
          };
          export default preview;
        `);
      });

      it('root globals satsifies as variable', () => {
        expect(
          removeField(
            ['globals'],
            dedent`
              const preview = {
                globals: { a: 1 },
                bar: { a: 1 }
              } satisfies Foo;
              export default preview;
            `
          )
        ).toMatchInlineSnapshot(`
          const preview = {
            bar: { a: 1 }
          } satisfies Foo;
          export default preview;
        `);
      });

      it('root globals as const satisfies as variable', () => {
        expect(
          removeField(
            ['globals'],
            dedent`
              const preview = {
                globals: { a: 1 },
                bar: { a: 1 }
              } as const satisfies Foo;
              export default preview;
            `
          )
        ).toMatchInlineSnapshot(`
          const preview = {
            bar: { a: 1 }
          } as const satisfies Foo;
          export default preview;
        `);
      });
    });

    describe('quotes', () => {
      it('no quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', '')).toMatchInlineSnapshot(`
          export const foo = {
            bar: "baz"
          };
        `);
      });
      it('more single quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', 'b', "c"]`))
          .toMatchInlineSnapshot(`
          export const stories = ['a', 'b', "c"]

          export const foo = {
            bar: 'baz'
          };
        `);
      });
      it('more double quotes', () => {
        expect(setField(['foo', 'bar'], 'baz', `export const stories = ['a', "b", "c"]`))
          .toMatchInlineSnapshot(`
          export const stories = ['a', "b", "c"]

          export const foo = {
            bar: "baz"
          };
        `);
      });
    });
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

      it(`supports pnp wrapped names`, () => {
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
    it(`supports setting a default import for a field that does not exist`, () => {
      const source = dedent`
        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setImport('path', 'path');

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        import path from 'path';
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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        import path from 'path';
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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        import { dirname } from 'path';
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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        import { dirname } from 'path';

        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a namespaced import`, () => {
      const config = loadConfig('').parse();
      config.setImport({ namespace: 'path' }, 'path');

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`import * as path from 'path';`);
    });

    it(`supports setting import without specifier`, () => {
      const config = loadConfig('').parse();
      config.setImport(null, 'path');

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`import 'path';`);
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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const path = require('path');
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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const {
          dirname,
        } = require('path');

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const {
          dirname,
          basename,
        } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`supports setting a named import for a field where the source already exists without "node:" prefix`, () => {
      const source = dedent`
        const { dirname } = require('path');

        const config: StorybookConfig = { };
        export default config;
      `;

      const config = loadConfig(source).parse();
      config.setRequireImport(['dirname', 'basename'], 'node:path');

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const {
          dirname,
          basename,
        } = require('path');

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const {
          basename,
        } = require('path');
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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        const {
          join,
        } = require('path');
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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(`
        import { join } from 'path';
        const config: StorybookConfig = { };
        export default config;
      `);
    });

    it(`removes a namespace ES6 import`, () => {
      const source = dedent`
        import * as path from 'path';
        const config: StorybookConfig = { };
        export default config;
      `;
      const config = loadConfig(source).parse();
      config.removeImport({ namespace: 'path' }, 'path');

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

      expect(parsed).toMatchInlineSnapshot(source);
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

      const parsed = babelPrint(config._ast);

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

      const parsed = babelPrint(config._ast);

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
      expect(config.getFieldValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a preset-style object entry', () => {
      const source = dedent`
        export default {
          addons: ['a', { name: 'b', options: {} }, 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getFieldValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a pnp-wrapped string entry', () => {
      const source = dedent`
        export default {
          addons: ['a', getAbsolutePath('b'), 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getFieldValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('removes a pnp-wrapped object entry', () => {
      const source = dedent`
        export default {
          addons: ['a',  { name: getAbsolutePath('b'), options: {} }, 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      config.removeEntryFromArray(['addons'], 'b');
      expect(config.getFieldValue(['addons'])).toMatchInlineSnapshot(`a,c`);
    });

    it('throws when entry is missing', () => {
      const source = dedent`
        export default {
          addons: ['a', { name: 'b', options: {} }, 'c'],
        }
      `;
      const config = loadConfig(source).parse();
      expect(() => config.removeEntryFromArray(['addons'], 'x')).toThrowErrorMatchingInlineSnapshot(
        `Error: Could not find 'x' in array at 'addons'`
      );
    });

    it('throws when target array is not an arral', () => {
      const source = dedent`
        export default {
          addons: {},
        }
      `;
      const config = loadConfig(source).parse();
      expect(() => config.removeEntryFromArray(['addons'], 'x')).toThrowErrorMatchingInlineSnapshot(
        `Error: Expected array at 'addons', got 'ObjectExpression'`
      );
    });
  });

  describe('parse', () => {
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
