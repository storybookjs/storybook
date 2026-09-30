import { describe, expect, it } from 'vitest';

import { loadCsf, printCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { wrapArgsMocks } from './wrap-args-mocks.ts';

expect.addSnapshotSerializer({
  serialize: (val: unknown) => String(val),
  test: () => true,
});

const transform = (source: string) => {
  const csf = loadCsf(source, { makeTitle: () => 'FIXME' }).parse();
  wrapArgsMocks(csf._ast);
  return printCsf(csf).code;
};

describe('wrapArgsMocks', () => {
  it('wraps mock calls on args in every hook of meta, stories and tests', () => {
    expect(
      transform(dedent`
        import { expect, fn } from 'storybook/test';
        import preview from '#.storybook/preview';

        const meta = preview.meta({
          component: Button,
          args: { getUsers: fn(), onClick: fn() },
          beforeEach: ({ args }) => {
            args.getUsers.mockResolvedValue([]);
          },
          loaders: [async ({ args }) => { args.getUsers.mockClear(); }],
          decorators: [(Story, { args }) => {
            args.onClick.mockClear();
            return <Story />;
          }],
        });

        export const Primary = meta.story({
          async play({ args }) {
            args.onClick.mockImplementation(() => {});
            await expect(args.onClick).toHaveBeenCalled();
            expect(args.onClick.mock.calls).toHaveLength(1);
          },
          afterEach: async (context) => {
            context.args.onClick.mockReset();
          },
        });

        export const Secondary = Primary.extend({
          play: async ({ args }) => {
            args.getUsers.mockReturnValue([{ id: 1 }]);
          },
        });

        Primary.test('calls onClick', async ({ args, canvas }) => {
          args.onClick.mockClear();
        });

        Primary.test('with overrides', { args: { label: 'Hi' } }, async ({ args }) => {
          args.onClick.mockClear();
          meta.input.args.getUsers.mockClear();
          Secondary.input.args.onClick.mockClear();
        });
      `)
    ).toMatchInlineSnapshot(`
      import { expect, fn, mocked } from 'storybook/test';
      import preview from '#.storybook/preview';

      const meta = preview.meta({
        component: Button,
        args: { getUsers: fn(), onClick: fn() },
        beforeEach: ({ args }) => {
          mocked(args.getUsers).mockResolvedValue([]);
        },
        loaders: [async ({ args }) => { mocked(args.getUsers).mockClear(); }],
        decorators: [(Story, { args }) => {
          mocked(args.onClick).mockClear();
          return <Story />;
        }],
      });

      export const Primary = meta.story({
        async play({ args }) {
          mocked(args.onClick).mockImplementation(() => {});
          await expect(args.onClick).toHaveBeenCalled();
          expect(mocked(args.onClick).mock.calls).toHaveLength(1);
        },
        afterEach: async (context) => {
          mocked(context.args.onClick).mockReset();
        },
      });

      export const Secondary = Primary.extend({
        play: async ({ args }) => {
          mocked(args.getUsers).mockReturnValue([{ id: 1 }]);
        },
      });

      Primary.test('calls onClick', async ({ args, canvas }) => {
        mocked(args.onClick).mockClear();
      });

      Primary.test('with overrides', { args: { label: 'Hi' } }, async ({ args }) => {
        mocked(args.onClick).mockClear();
        mocked(meta.input.args.getUsers).mockClear();
        mocked(Secondary.input.args.onClick).mockClear();
      });
    `);
  });

  it('follows args through destructuring, renames, aliases and shared functions', () => {
    expect(
      transform(dedent`
        import preview from '#.storybook/preview';

        const sharedPlay = async (context) => {
          const { getUsers } = context.args;
          getUsers.mockClear();
        };

        const meta = preview.meta({ component: Button });

        export const A = meta.story({
          play: async ({ args: { getUsers, onClick: click } }) => {
            getUsers.mockResolvedValueOnce([]);
            click.mockRejectedValue(new Error());
          },
        });

        export const B = meta.story({
          play: async ({ args: storyArgs }) => {
            storyArgs.getUsers.mockName('getUsers');
            const alias = storyArgs;
            alias.onClick.mockReset();
            const onClick = alias.onClick;
            onClick.mockRestore();
          },
        });

        export const C = meta.story({ play: sharedPlay });
      `)
    ).toMatchInlineSnapshot(`
      import preview from '#.storybook/preview';

      import { mocked } from "storybook/test";

      const sharedPlay = async (context) => {
        const { getUsers } = context.args;
        mocked(getUsers).mockClear();
      };

      const meta = preview.meta({ component: Button });

      export const A = meta.story({
        play: async ({ args: { getUsers, onClick: click } }) => {
          mocked(getUsers).mockResolvedValueOnce([]);
          mocked(click).mockRejectedValue(new Error());
        },
      });

      export const B = meta.story({
        play: async ({ args: storyArgs }) => {
          mocked(storyArgs.getUsers).mockName('getUsers');
          const alias = storyArgs;
          mocked(alias.onClick).mockReset();
          const onClick = alias.onClick;
          mocked(onClick).mockRestore();
        },
      });

      export const C = meta.story({ play: sharedPlay });
    `);
  });

  it('treats the first parameter of render as args', () => {
    expect(
      transform(dedent`
        import { fn } from 'storybook/test';
        import preview from '#.storybook/preview';

        const meta = preview.meta({ component: Button, args: { onClick: fn() } });

        export const A = meta.story({
          render: (args, { args: contextArgs }) => {
            args.onClick.mockClear();
            contextArgs.onClick.mockReset();
            return null;
          },
        });

        export const B = meta.story({
          render({ onClick }) {
            onClick.mockReset();
            return null;
          },
        });

        export const C = meta.story({
          render: ((args) => {
            args.onClick.mockClear();
            return null;
          }) as any,
        });
      `)
    ).toMatchInlineSnapshot(`
      import { fn, mocked } from 'storybook/test';
      import preview from '#.storybook/preview';

      const meta = preview.meta({ component: Button, args: { onClick: fn() } });

      export const A = meta.story({
        render: (args, { args: contextArgs }) => {
          mocked(args.onClick).mockClear();
          mocked(contextArgs.onClick).mockReset();
          return null;
        },
      });

      export const B = meta.story({
        render({ onClick }) {
          mocked(onClick).mockReset();
          return null;
        },
      });

      export const C = meta.story({
        render: ((args) => {
          mocked(args.onClick).mockClear();
          return null;
        }) as any,
      });
    `);
  });

  it('wraps optional calls, and sees through non-null assertions, casts and string keys', () => {
    expect(
      transform(dedent`
        import { fn } from 'storybook/test';
        import preview from '#.storybook/preview';

        const meta = preview.meta({ component: Button });

        export const A = meta.story({
          play: async ({ args }) => {
            args.onClick?.mockClear();
            args!.onClick.mockClear();
            args.onClick!.mockReset();
            (args as any).onClick.mockRestore();
            args['on-click'].mockClear();
          },
        });
      `)
    ).toMatchInlineSnapshot(`
      import { fn, mocked } from 'storybook/test';
      import preview from '#.storybook/preview';

      const meta = preview.meta({ component: Button });

      export const A = meta.story({
        play: async ({ args }) => {
          mocked(args.onClick)?.mockClear();
          mocked(args!.onClick).mockClear();
          mocked(args.onClick!).mockReset();
          mocked((args as any).onClick).mockRestore();
          mocked(args['on-click']).mockClear();
        },
      });
    `);
  });

  it('leaves calls that are already wrapped and mocks that are not args untouched', () => {
    const source = dedent`
      import { fn, mocked } from 'storybook/test';
      import preview from '#.storybook/preview';

      const getUsers = fn();

      const meta = preview.meta({ component: Button });

      export const A = meta.story({
        play: async ({ args }) => {
          mocked(args.onClick).mockClear();
          getUsers.mockClear();
          const other = { getUsers };
          other.getUsers.mockClear();
          await expect(args.onClick).toHaveBeenCalled();
        },
      });
    `;

    expect(transform(source)).toBe(source);
  });

  describe('the mocked import', () => {
    const story = dedent`
      import preview from '#.storybook/preview';

      const meta = preview.meta({ component: Button });

      export const A = meta.story({
        play: async ({ args }) => {
          args.onClick.mockClear();
        },
      });
    `;

    it('reuses an existing import, also when renamed', () => {
      expect(transform(`import { mocked as m } from 'storybook/test';\n${story}`))
        .toMatchInlineSnapshot(`
          import { mocked as m } from 'storybook/test';
          import preview from '#.storybook/preview';

          const meta = preview.meta({ component: Button });

          export const A = meta.story({
            play: async ({ args }) => {
              m(args.onClick).mockClear();
            },
          });
        `);
    });

    it('uses a namespace import', () => {
      expect(transform(`import * as test from 'storybook/test';\n${story}`)).toContain(
        'test.mocked(args.onClick).mockClear();'
      );
    });

    it('adds it to an existing named import', () => {
      expect(transform(`import { fn } from 'storybook/test';\n${story}`)).toContain(
        `import { fn, mocked } from 'storybook/test';`
      );
    });

    it('adds a new import after the last import', () => {
      expect(transform(story)).toMatchInlineSnapshot(`
          import preview from '#.storybook/preview';

          import { mocked } from "storybook/test";

          const meta = preview.meta({ component: Button });

          export const A = meta.story({
            play: async ({ args }) => {
              mocked(args.onClick).mockClear();
            },
          });
        `);
    });

    it('adds a value import next to a type-only one', () => {
      expect(transform(`import { type mocked } from 'storybook/test';\n${story}`)).toContain(
        `import { type mocked, mocked as _mocked } from 'storybook/test';`
      );
    });

    it('adds its own import when the existing one is shadowed', () => {
      const shadowed = story.replace('play: async ({ args }) => {', '$&\n      const m = 1;');

      expect(transform(`import { mocked as m } from 'storybook/test';\n${shadowed}`)).toContain(
        `import { mocked as m, mocked } from 'storybook/test';`
      );
    });

    it('renames it when mocked is already taken', () => {
      const result = transform(
        `import { fn } from 'storybook/test';\nimport { mocked } from './utils';\n${story}`
      );

      expect(result).toContain(`import { fn, mocked as _mocked } from 'storybook/test';`);
      expect(result).toContain('_mocked(args.onClick).mockClear();');
    });
  });

  it('reports whether it changed anything', () => {
    const csf = (source: string) => loadCsf(source, { makeTitle: () => 'FIXME' }).parse()._ast;

    expect(
      wrapArgsMocks(
        csf(`export default {}; export const A = { play: ({ args }) => args.onClick.mockClear() };`)
      )
    ).toBe(true);
    expect(
      wrapArgsMocks(
        csf(`export default {}; export const A = { play: ({ args }) => args.onClick() };`)
      )
    ).toBe(false);
  });
});
