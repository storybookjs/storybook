import { describe, expect, it, vi } from 'vitest';

import { formatFileContent } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import path from 'path';
import { dedent } from 'ts-dedent';

import { storyToCsfFactory } from './story-to-csf-factory.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

describe('stories codemod', () => {
  const transform = async (source: string) =>
    formatFileContent(
      'Component.stories.tsx',
      await storyToCsfFactory(
        { source, path: 'Component.stories.tsx' },
        { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
      )
    );
  describe('javascript', () => {
    it('should wrap const declared meta', async () => {
      await expect(
        transform(dedent`
            const meta = { title: 'Component' };
            export default meta;
            export const A = {};
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        const meta = preview.meta({ title: "Component" });
        export const A = meta.story();
      `);
    });

    it('should preserve leading comments when adding import', async () => {
      await expect(
        transform(dedent`
            // @ts-check
            /**
             * @license MIT
             * Copyright 2024
             */
            const meta = { title: 'Component' };
            export default meta;
            export const A = {};
          `)
      ).resolves.toMatchInlineSnapshot(`
        // @ts-check
        /**
         * @license MIT
         * Copyright 2024
         */
        import preview from "#.storybook/preview";

        const meta = preview.meta({ title: "Component" });
        export const A = meta.story();
      `);
    });

    it('should transform and wrap inline default exported meta', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
            export const A = {};
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";

        const meta = preview.meta({
          title: "Component",
        });

        export const A = meta.story();
      `);
    });

    it('should keep the original meta variable name', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {};
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        const componentMeta = preview.meta({ title: "Component" });
        export const A = componentMeta.story();
      `);
    });

    it('should wrap stories in a meta.story method', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        const componentMeta = preview.meta({ title: "Component" });
        export const A = componentMeta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('should respect existing config imports', async () => {
      await expect(
        transform(dedent`
            import { decorators } from "#.storybook/preview";
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview, { decorators } from "#.storybook/preview";
        const componentMeta = preview.meta({ title: "Component" });
        export const A = componentMeta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('should reuse existing default config import name', async () => {
      await expect(
        transform(dedent`
            import previewConfig from "#.storybook/preview";
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import previewConfig from "#.storybook/preview";
        const componentMeta = previewConfig.meta({ title: "Component" });
        export const A = componentMeta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('if there is an existing local constant called preview, rename storybook preview import', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            const preview = {};
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import storybookPreview from "#.storybook/preview";
        const componentMeta = storybookPreview.meta({ title: "Component" });
        const preview = {};
        export const A = componentMeta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('migrate reused properties of other stories from `Story.xyz` to `Story.input.xyz`', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
            const someData = {};

            export const A = {};
            
            export const B = {
              ...A,
              args: {
                ...A.args,
                ...someData,
              },
            };
            export const C = {
              render: async () => {
                return JSON.stringify({
                  ...A.argTypes,
                  ...B,
                })
              }
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";

        const meta = preview.meta({
          title: "Component",
        });

        const someData = {};

        export const A = meta.story();

        export const B = meta.story({
          ...A.input,
          args: {
            ...A.input.args,
            ...someData,
          },
        });
        export const C = meta.story({
          render: async () => {
            return JSON.stringify({
              ...A.input.argTypes,
              ...B.input,
            });
          },
        });
      `);
    });

    it('migrate reused properties of meta from `meta.xyz` to `meta.input.xyz`', async () => {
      await expect(
        transform(dedent`
            const myMeta = { title: 'Component', args: {} };
            export default myMeta;

            const metaProperties = {
              ...myMeta,
            }

            export const A = {
              args: myMeta.args,
            };
            
            export const B = {
              args: {
                ...myMeta.args,
                ...metaProperties.args,
              },
            };
            export const C = {
              render: async () => {
                return JSON.stringify({
                  ...myMeta.argTypes,
                })
              }
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        const myMeta = preview.meta({ title: "Component", args: {} });

        const metaProperties = {
          ...myMeta.input,
        };

        export const A = myMeta.story({
          args: myMeta.input.args,
        });

        export const B = myMeta.story({
          args: {
            ...myMeta.input.args,
            ...metaProperties.args,
          },
        });
        export const C = myMeta.story({
          render: async () => {
            return JSON.stringify({
              ...myMeta.input.argTypes,
            });
          },
        });
      `);
    });

    it('migrate cross-file story imports from `ImportedStories.Story.xyz` to `ImportedStories.Story.input.xyz`', async () => {
      await expect(
        transform(dedent`
            import * as BaseStories from './Button.stories';
            import { Primary as ImportedPrimary } from './Card.stories';

            export default { title: 'Component' };

            export const A = {
              args: BaseStories.Primary.args,
            };

            export const B = {
              ...BaseStories.Secondary,
              args: {
                ...BaseStories.Secondary.args,
                label: 'Custom',
              },
            };

            export const C = {
              args: {
                ...ImportedPrimary.args,
              },
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import * as BaseStories from "./Button.stories";
        import { Primary as ImportedPrimary } from "./Card.stories";

        const meta = preview.meta({
          title: "Component",
        });

        export const A = meta.story({
          args: BaseStories.Primary.input.args,
        });

        export const B = meta.story({
          ...BaseStories.Secondary.input,
          args: {
            ...BaseStories.Secondary.input.args,
            label: "Custom",
          },
        });

        export const C = meta.story({
          args: {
            ...ImportedPrimary.input.args,
          },
        });
      `);
    });

    it('does not migrate reused properties from disallowed list', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
            export const A = {};
            export const B = {
              play: async () => {
                await A.play();
              }
            };
            export const C = A.run;
            export const D = A.extends({});
          `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: "Component" };
        export const A = {};
        export const B = {
          play: async () => {
            await A.play();
          },
        };
        export const C = A.run;
        export const D = A.extends({});
      `);
    });

    it.todo('should support non-conventional formats', async () => {
      const transformed = await transform(dedent`
        import { A as Component } from './Button';
        import * as Stories from './Other.stories';
        import someData from './fixtures'
        export default { 
          component: Component, 
          // not supported yet (story coming from another file)
          args: Stories.A.args
        };
        const data = {};
        export const A = () => {};
        export function B() { };
        // not supported yet (story redeclared)
        const C = { ...A, args: data, };
        const D = { args: data };
        export { C, D as E };
        `);

      expect(transformed).toMatchInlineSnapshot(`
        import { A as Component } from './Button';
        import * as Stories from './Other.stories';
        import someData from './fixtures';

        export default {
          component: Component,
          // not supported yet (story coming from another file)
          args: Stories.A.args,
        };
        const data = {};
        export const A = () => {};
        export function B() {}
        // not supported yet (story redeclared)
        const C = { ...A, args: data };
        const D = { args: data };
        export { C, D as E };
      `);

      expect(transformed).toContain('A = meta.story');
      expect(transformed).toContain('B = meta.story');
      // @TODO: when we support these, uncomment this line
      // expect(transformed).toContain('C = meta.story');
    });

    it('converts the preview import path based on useSubPathImports flag', async () => {
      const relativeMock = vi.spyOn(path, 'relative').mockReturnValue('../../preview.ts');

      try {
        await expect(
          formatFileContent(
            'Component.stories.tsx',
            await storyToCsfFactory(
              {
                source: dedent`
                  import preview, { extra } from '../../../.storybook/preview';
                  export default {};
                  export const A = {};
                `,
                path: 'Component.stories.tsx',
              },
              { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
            )
          )
        ).resolves.toMatchInlineSnapshot(`
          import preview, { extra } from "#.storybook/preview";
          const meta = preview.meta({});
          export const A = meta.story();
        `);

        await expect(
          formatFileContent(
            'Component.stories.tsx',
            await storyToCsfFactory(
              {
                source: dedent`
                  import preview, { extra } from '#.storybook/preview';
                  export default {};
                  export const A = {};
                `,
                path: 'Component.stories.tsx',
              },
              { previewConfigPath: '#.storybook/preview', useSubPathImports: false }
            )
          )
        ).resolves.toMatchInlineSnapshot(`
          import preview, { extra } from "../../preview";
          const meta = preview.meta({});
          export const A = meta.story();
        `);
      } finally {
        relativeMock.mockRestore();
      }
    });

    it('converts CSF1 into CSF4 with render', async () => {
      await expect(
        transform(dedent`
            const meta = { title: 'Component' };
            export default meta;
            export const CSF1Story = () => <div>Hello</div>;
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        const meta = preview.meta({ title: "Component" });
        export const CSF1Story = meta.story(() => <div>Hello</div>);
      `);
    });
  });

  describe('typescript', () => {
    const inlineMetaSatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default { title: 'Component', component: Component } satisfies Meta<ComponentProps>;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta satisfies syntax', async () => {
      await expect(transform(inlineMetaSatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const inlineMetaAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default { title: 'Component', component: Component } as Meta<ComponentProps>;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta as syntax', async () => {
      await expect(transform(inlineMetaAs)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });
    const metaSatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } satisfies Meta<ComponentProps>
        export default meta;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta satisfies syntax', async () => {
      await expect(transform(metaSatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const metaTypeDef = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta: Meta<ComponentProps> = { title: 'Component', component: Component }
        export default meta;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta type syntax', async () => {
      await expect(transform(metaTypeDef)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const metaAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta as syntax', async () => {
      await expect(transform(metaAs)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const storySatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A = {
          args: { primary: true }
        } satisfies CSF3<ComponentProps>;
      `;
    it('story satisfies syntax', async () => {
      await expect(transform(storySatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const storyAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A = {
          args: { primary: true }
        } as CSF3<ComponentProps>;
      `;
    it('story as syntax', async () => {
      await expect(transform(storyAs)).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview
          .type<{ args: ComponentProps }>()
          .meta({ title: "Component", component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    it('should yield the same result to all syntaxes', async () => {
      const allSnippets = await Promise.all([
        transform(inlineMetaSatisfies),
        transform(inlineMetaAs),
        transform(metaSatisfies),
        transform(metaAs),
        transform(storySatisfies),
        transform(storyAs),
      ]);

      allSnippets.forEach((result) => {
        expect(result).toEqual(allSnippets[0]);
      });
    });

    describe('custom args types', () => {
      it('carries the custom args type of the meta over to preview.type', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/angular';
            import { MyComponent } from './my.component';
            import { type Icon, DeactivatedOrg } from './icons';

            type StoryArgs = {
              pageIcon: Icon;
            };

            export default {
              component: MyComponent,
              args: {
                pageIcon: DeactivatedOrg,
              },
            } satisfies Meta<StoryArgs>;

            export const Default: StoryObj<StoryArgs> = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { MyComponent } from "./my.component";
          import { type Icon, DeactivatedOrg } from "./icons";

          type StoryArgs = {
            pageIcon: Icon;
          };

          const meta = preview.type<{ args: StoryArgs }>().meta({
            component: MyComponent,
            args: {
              pageIcon: DeactivatedOrg,
            },
          });

          export const Default = meta.story();
        `);
      });

      it.each([
        ['Meta', 'Meta<StoryArgs>'],
        ['MetaObj', 'MetaObj<StoryArgs>'],
        ['a renamed import', 'CSF3Meta<StoryArgs>'],
      ])('supports %s', async (_, type) => {
        await expect(
          transform(dedent`
            import type { Meta, MetaObj, Meta as CSF3Meta } from '@storybook/react';
            import { Button } from './Button';
            import type { StoryArgs } from './types';

            export default { component: Button } satisfies ${type};

            export const A = {};
          `)
        ).resolves.toContain('preview.type<{ args: StoryArgs }>().meta({ component: Button })');
      });

      it.each([
        ['Meta without a type argument', 'Meta'],
        ['Meta of the component', 'Meta<typeof Button>'],
        ['Meta of the component class', 'Meta<Button>'],
        ['Meta of a generic component class', 'Meta<Button<string>>'],
        ['Meta of an alias of the component', 'Meta<ButtonAlias>'],
        ['ComponentMeta, which only takes a component', 'ComponentMeta<ButtonType>'],
        ['a type that is not a Storybook type', 'CustomMeta<StoryArgs>'],
      ])('infers the args from the component for %s', async (_, type) => {
        await expect(
          transform(dedent`
            import type { Meta, ComponentMeta, StoryObj } from '@storybook/react';
            import { Button, type ButtonType } from './Button';
            import type { CustomMeta, StoryArgs } from './types';

            type ButtonAlias = typeof Button;

            const meta = { component: Button } satisfies ${type};
            export default meta;

            export const A: StoryObj<typeof meta> = {};
            export const B: StoryObj<typeof Button> = {};
            export const C: StoryObj<Button> = {};
            export const D: StoryObj = {};
            export const E: StoryObj<Meta<typeof Button>> = {};
          `)
        ).resolves.toContain('const meta = preview.meta({ component: Button });');
      });

      it('keeps a type argument that extends the props of the component', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/react';
            import { Button, type ButtonProps } from './Button';

            const meta = {
              component: Button,
              args: { theme: 'dark' },
            } satisfies Meta<ButtonProps & { theme: string }>;
            export default meta;

            export const A: StoryObj<typeof meta> = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Button, type ButtonProps } from "./Button";

          const meta = preview.type<{ args: ButtonProps & { theme: string } }>().meta({
            component: Button,
            args: { theme: "dark" },
          });

          export const A = meta.story();
        `);
      });

      it('leaves the component class out of an intersection, as its args are inferred', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/angular';
            import { Page } from './page.component';

            const meta: Meta<Page & { footer?: string }> = {
              component: Page,
            };
            export default meta;

            export const CustomFooter: StoryObj<Page & { footer?: string }> = {
              args: { footer: 'Built with Storybook' },
            };
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Page } from "./page.component";

          const meta = preview.type<{ args: { footer?: string } }>().meta({
            component: Page,
          });

          export const CustomFooter = meta.story({
            args: { footer: "Built with Storybook" },
          });
        `);
      });

      it('omits the keys of the component class from a type alias that includes it', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/angular';
            import { Page } from './page.component';

            type PagePropsAndCustomArgs = Page & { footer?: string };

            const meta: Meta<PagePropsAndCustomArgs> = {
              component: Page,
            };
            export default meta;

            type Story = StoryObj<PagePropsAndCustomArgs>;

            export const CustomFooter: Story = {
              args: { footer: 'Built with Storybook' },
            };
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Page } from "./page.component";

          type PagePropsAndCustomArgs = Page & { footer?: string };

          const meta = preview
            .type<{ args: Omit<PagePropsAndCustomArgs, keyof Page> }>()
            .meta({
              component: Page,
            });

          export const CustomFooter = meta.story({
            args: { footer: "Built with Storybook" },
          });
        `);
      });

      it('leaves the component class out of the custom args type of a story', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/angular';
            import { Page } from './page.component';

            const meta: Meta<Page> = { component: Page };
            export default meta;

            export const Default: StoryObj<Page> = {};
            export const CustomFooter: StoryObj<Page & { footer: string }> = {
              args: { footer: 'Built with Storybook' },
            };
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Page } from "./page.component";

          const meta = preview.meta({ component: Page });

          export const Default = meta.story();
          export const CustomFooter = meta.type<{ args: { footer: string } }>().story({
            args: { footer: "Built with Storybook" },
          });
        `);
      });

      it.each([
        [
          'makes the custom args optional next to a component',
          "component: 'demo-page'",
          '.type<{ args: Partial<PageProps> }>()',
          '.type<{ args: Partial<{ footer: string }> }>()',
        ],
        [
          'keeps the custom args as they are without a component',
          'render: (args) => Page(args)',
          '.type<{ args: PageProps }>()',
          'meta.type<{ args: { footer: string } }>().story()',
        ],
      ])('%s in Web Components', async (_, annotation, metaType, storyType) => {
        const transformed = await transform(dedent`
          import type { Meta, StoryObj } from '@storybook/web-components-vite';
          import { Page, type PageProps } from './Page';

          const meta = { ${annotation} } satisfies Meta<PageProps>;
          export default meta;

          export const Default: StoryObj<PageProps> = {};
          export const CustomFooter: StoryObj<PageProps & { footer: string }> = {};
        `);

        expect(transformed).toContain(metaType);
        expect(transformed).toContain('export const Default = meta.story();');
        expect(transformed).toContain(storyType);
      });

      it('carries the custom args type over when the meta has no component', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/react';
            import type { StoryArgs } from './types';

            const meta = {
              render: (args) => <Page icon={args.pageIcon} />,
            } satisfies Meta<StoryArgs>;
            export default meta;

            export const A: StoryObj<typeof meta> = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import type { StoryArgs } from "./types";

          const meta = preview.type<{ args: StoryArgs }>().meta({
            render: (args) => <Page icon={args.pageIcon} />,
          });

          export const A = meta.story();
        `);
      });

      it('keeps the custom args type of a story on that story', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryFn, StoryObj } from '@storybook/react';
            import { Button } from './Button';
            import type { StoryArgs } from './types';

            const meta = { component: Button } satisfies Meta<typeof Button>;
            export default meta;

            export const Annotated: StoryObj<StoryArgs> = {};
            export const Satisfies = {} satisfies StoryObj<StoryArgs>;
            export const As = {} as StoryObj<StoryArgs>;
            export const Nested: StoryObj<Meta<StoryArgs>> = {};
            export const Fn: StoryFn<StoryArgs> = () => <Button />;
            export const Reused: StoryObj<StoryArgs> = { ...Annotated, args: { ...Annotated.args } };
            export const Inferred: StoryObj<typeof meta> = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Button } from "./Button";
          import type { StoryArgs } from "./types";

          const meta = preview.meta({ component: Button });

          export const Annotated = meta.type<{ args: StoryArgs }>().story();
          export const Satisfies = meta.type<{ args: StoryArgs }>().story();
          export const As = meta.type<{ args: StoryArgs }>().story();
          export const Nested = meta.type<{ args: StoryArgs }>().story();
          export const Fn = meta.type<{ args: StoryArgs }>().story(() => <Button />);
          export const Reused = meta
            .type<{ args: StoryArgs }>()
            .story({ ...Annotated.input, args: { ...Annotated.input.args } });
          export const Inferred = meta.story();
        `);
      });

      it('reads the custom args type through a type alias of Meta and of StoryObj', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/react';
            import { Button } from './Button';
            import type { StoryArgs } from './types';

            type StoryMeta = Meta<StoryArgs>;
            type Story = StoryObj<StoryMeta>;

            export default { component: Button } satisfies Meta<typeof Button>;

            export const A: Story = {};
          `)
        ).resolves.toContain('preview.type<{ args: StoryArgs }>().meta(');
      });

      it('writes a custom args type that every story has once, on the meta', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/angular';
            import { Page } from './page.component';

            const meta: Meta<Page> = { component: Page };
            export default meta;

            type Story = StoryObj<Page & { content: string }>;

            export const A: Story = { args: { content: 'a' } };
            export const B: Story = { args: { content: 'b' } };
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Page } from "./page.component";

          const meta = preview
            .type<{ args: { content: string } }>()
            .meta({ component: Page });

          export const A = meta.story({ args: { content: "a" } });
          export const B = meta.story({ args: { content: "b" } });
        `);
      });

      it('puts a union in parentheses when it is intersected', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/react';
            import { Button } from './Button';
            import type { Small, Themed, Wide } from './types';

            export default { component: Button } satisfies Meta<typeof Button>;

            export const Default: StoryObj<typeof Button> = {};
            export const Sized: StoryObj<Small | Wide> = {} satisfies StoryObj<Themed>;
          `)
        ).resolves.toContain('meta.type<{ args: (Small | Wide) & Themed }>().story()');
      });

      it('leaves out of the custom args type of a story what the meta already has', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj, StoryFn } from '@storybook/react';
            import { Button, type ButtonProps } from './Button';

            const meta = { component: Button } satisfies Meta<ButtonProps>;
            export default meta;

            export const Same: StoryObj<ButtonProps> = {};
            export const Themed: StoryObj<ButtonProps & { theme: string }> = {};
            export const Sized: StoryFn<{ size: number } | { width: number }> = () => <Button />;
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import { Button, type ButtonProps } from "./Button";

          const meta = preview.type<{ args: ButtonProps }>().meta({ component: Button });

          export const Same = meta.story();
          export const Themed = meta.type<{ args: { theme: string } }>().story();
          export const Sized = meta
            .type<{ args: { size: number } | { width: number } }>()
            .story(() => <Button />);
        `);
      });

      it('keeps a Storybook type that the custom args type is built from', async () => {
        await expect(
          transform(dedent`
            import type { Meta, StoryObj } from '@storybook/react';
            import { Button } from './Button';

            type StoryArgs = NonNullable<StoryObj<typeof Button>['args']> & { theme: string };

            export default { component: Button } satisfies Meta<StoryArgs>;

            export const A: StoryObj<StoryArgs> = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import preview from "#.storybook/preview";
          import type { StoryObj } from "@storybook/react";
          import { Button } from "./Button";

          type StoryArgs = NonNullable<StoryObj<typeof Button>["args"]> & {
            theme: string;
          };

          const meta = preview.type<{ args: StoryArgs }>().meta({ component: Button });

          export const A = meta.story();
        `);
      });

      it('uses the name of the preview import', async () => {
        await expect(
          transform(dedent`
            import type { Meta } from '@storybook/react';
            import { Button } from './Button';
            import type { StoryArgs } from './types';

            const preview = {};

            export default { component: Button } satisfies Meta<StoryArgs>;

            export const A = {};
          `)
        ).resolves.toMatchInlineSnapshot(`
          import storybookPreview from "#.storybook/preview";
          import { Button } from "./Button";
          import type { StoryArgs } from "./types";

          const preview = {};

          const meta = storybookPreview
            .type<{ args: StoryArgs }>()
            .meta({ component: Button });

          export const A = meta.story();
        `);
      });
    });

    it('should remove unused Story types', async () => {
      await expect(
        transform(
          `import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default {};
        type Story = StoryObj<typeof ComponentProps>;

        export const A: Story = {};`
        )
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { ComponentProps } from "./Component";

        const meta = preview.meta({});

        export const A = meta.story();
      `);
    });

    it('should preserve user-defined generic types', async () => {
      const result = await transform(dedent`
        import { Meta, StoryObj } from '@storybook/react';
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type Data = Record<string, any>;
        interface UnusedButShouldNotBeRemoved { name: string };
        type UnusedAndShouldBeRemoved = Meta;

        export default { title: 'Table' };

        export const A = {
          render: () => {
            const data: Data[] = [];
            return <Table data={data} />;
          }
        };
      `);

      expect(result).toContain('UnusedButShouldNotBeRemoved');
      expect(result).not.toContain('UnusedAndShouldBeRemoved');

      expect(result).toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type Data = Record<string, any>;
        interface UnusedButShouldNotBeRemoved {
          name: string;
        }

        const meta = preview.meta({
          title: "Table",
        });

        export const A = meta.story({
          render: () => {
            const data: Data[] = [];
            return <Table data={data} />;
          },
        });
      `);
    });

    it('should remove Storybook-specific type aliases but leave the ones that are actually used', async () => {
      await expect(
        transform(dedent`
          import { Meta, StoryObj, ComponentStory, ComponentMeta } from '@storybook/react';
          import { Button } from './Button';

          type CustomMeta = Meta<typeof Button>;
          type CustomStory = StoryObj<typeof Button>;
          type LegacyStory = ComponentStory<typeof Button>;
          type LegacyMeta = ComponentMeta<typeof Button>;
          type ThisShouldNotBeRemoved = Meta<typeof Button>;
          const something: ThisShouldNotBeRemoved = {};

          export default { title: 'Button' };
          export const A = {};
        `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { Meta } from "@storybook/react";
        import { Button } from "./Button";

        type ThisShouldNotBeRemoved = Meta<typeof Button>;
        const something: ThisShouldNotBeRemoved = {};

        const meta = preview.meta({
          title: "Button",
        });

        export const A = meta.story();
      `);
    });

    it.todo('should support non-conventional formats', async () => {
      const transformed = await transform(dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
        import { A as Component } from './Button';
        import * as Stories from './Other.stories';
        import someData from './fixtures'
        export default {
          title: 'Component',
          component: Component, 
          // not supported yet (story coming from another file)
          args: Stories.A.args
        };
        const data = {};
        export const A: StoryObj = () => {};
        export function B() { };
        export const C = () => <Component />;
        export const D = C;
        // not supported yet (story redeclared)
        const E = { ...A, args: data, } satisfies CSF3<ComponentProps>;
        const F = { args: data };
        export { E, F as G };
        `);

      expect(transformed).toMatchInlineSnapshot(`
        import { StoryObj as CSF3, Meta } from '@storybook/react';

        import { A as Component } from './Button';
        import { ComponentProps } from './Component';
        import * as Stories from './Other.stories';
        import someData from './fixtures';

        export default {
          title: 'Component',
          component: Component,
          // not supported yet (story coming from another file)
          args: Stories.A.args,
        };
        const data = {};
        export const A: StoryObj = () => {};
        export function B() {}
        export const C = () => <Component />;
        export const D = C;
        // not supported yet (story redeclared)
        const E = { ...A, args: data } satisfies CSF3<ComponentProps>;
        const F = { args: data };
        export { E, F as G };
      `);

      expect(transformed).toContain('A = meta.story');
      expect(transformed).toContain('B = meta.story');
      // @TODO: when we support these, uncomment this line
      // expect(transformed).toContain('C = meta.story');
    });

    it('should skip and report when the file could not be parsed', async () => {
      vi.mocked(logger.log).mockClear();
      const source = 'export const A = {';
      const result = await storyToCsfFactory(
        { source, path: 'Broken.stories.tsx' },
        { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
      );

      expect(result).toBe(source);
      expect(vi.mocked(logger.log).mock.calls[0][0]).toBe(
        'Error when parsing Broken.stories.tsx, skipping: file could not be parsed'
      );
      expect(vi.mocked(logger.log).mock.calls[0][0]).not.toContain('missing default export');
    });

    it('should keep the missing default export message for a file that parses', async () => {
      vi.mocked(logger.log).mockClear();
      const source = dedent`
        export const A = () => {};
      `;
      const result = await storyToCsfFactory(
        { source, path: 'NoMeta.stories.tsx' },
        { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
      );

      expect(result).toBe(source);
      expect(vi.mocked(logger.log).mock.calls[0][0]).toContain('missing default export');
    });

    it('should bail transformation when no stories can be transformed', async () => {
      const source = dedent`
        export default {
          title: 'Component',
        };
      `;
      const transformed = await transform(source);
      const formattedSource = await formatFileContent('Component.stories.tsx', source);
      expect(transformed).toEqual(formattedSource);

      expect(transformed).not.toContain('preview.meta');
      expect(transformed).not.toContain('meta.story');

      expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(
        `Skipping codemod for Component.stories.tsx: no stories were transformed. Either there are no stories, file has been already transformed or some stories are written in an unsupported format.`
      );
    });

    it('should bail transformation and warn if some stories are not transformed to avoid mixed CSF formats', async () => {
      const source = dedent`
        export default {
          title: 'Component',
        };
        export const A = {};
        // not supported yet (story redeclared)
        const B = { args: data };
        const C = { args: data };
        export { B, C as D };`;
      const transformed = await transform(source);
      const formattedSource = await formatFileContent('Component.stories.tsx', source);
      expect(transformed).toEqual(formattedSource);

      expect(transformed).not.toContain('preview.meta');
      expect(transformed).not.toContain('meta.story');

      expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(`
        Skipping codemod for Component.stories.tsx:
        Some of the detected stories ["A", "B", "D"] would not be transformed because they are written in an unsupported format.
      `);
    });

    it('should bail transformation and not warn when file is already transformed', async () => {
      const source = dedent`
        import preview from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
        export const A = meta.story();
      `;
      const transformed = await transform(source);
      const formattedSource = await formatFileContent('Component.stories.tsx', source);
      expect(transformed).toEqual(formattedSource);

      expect(logger.log).not.toHaveBeenCalled();
    });
  });

  describe('mock API on args', () => {
    it('wraps mock calls on args in play, beforeEach, afterEach and loaders in mocked()', async () => {
      await expect(
        transform(dedent`
          import { expect, fn } from 'storybook/test';

          export default {
            component: Component,
            args: { getUsers: fn(), onClick: fn() },
            beforeEach: ({ args }) => {
              args.getUsers.mockResolvedValue([]);
            },
            loaders: [async ({ args }) => { args.getUsers.mockClear(); }],
          };

          export const A = {
            async play({ args, canvas }) {
              args.getUsers.mockReturnValue([{ id: 1 }]);
              args.onClick.mockImplementation(() => {});
              await expect(args.onClick).toHaveBeenCalled();
              expect(args.onClick.mock.calls).toHaveLength(1);
            },
            afterEach: async (context) => {
              context.args.onClick.mockReset();
            },
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { expect, fn, mocked } from "storybook/test";

        const meta = preview.meta({
          component: Component,
          args: { getUsers: fn(), onClick: fn() },

          beforeEach: ({ args }) => {
            mocked(args.getUsers).mockResolvedValue([]);
          },

          loaders: [
            async ({ args }) => {
              mocked(args.getUsers).mockClear();
            },
          ],
        });

        export const A = meta.story({
          async play({ args, canvas }) {
            mocked(args.getUsers).mockReturnValue([{ id: 1 }]);
            mocked(args.onClick).mockImplementation(() => {});
            await expect(args.onClick).toHaveBeenCalled();
            expect(mocked(args.onClick).mock.calls).toHaveLength(1);
          },
          afterEach: async (context) => {
            mocked(context.args.onClick).mockReset();
          },
        });
      `);
    });

    it('wraps mock calls on meta.args after rewriting them to meta.input.args', async () => {
      await expect(
        transform(dedent`
          const meta = { component: Component, args: { onClick: fn() } };
          export default meta;

          export const A = {
            play: async () => {
              meta.args.onClick.mockRestore();
            },
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from "#.storybook/preview";
        import { mocked } from "storybook/test";
        const meta = preview.meta({ component: Component, args: { onClick: fn() } });

        export const A = meta.story({
          play: async () => {
            mocked(meta.input.args.onClick).mockRestore();
          },
        });
      `);
    });
  });
});
