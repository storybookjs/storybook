import { describe, expect, it } from 'vitest';

import { loadCsf, printCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { getDiff } from '../../../../../core/src/core-server/utils/save-story/getDiff';
import { removeUnusedTypes } from './remove-unused-types';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

describe('removeUnusedTypes', () => {
  const getTransformed = (source: string) => {
    const csf = loadCsf(source, { makeTitle: () => 'FIXME' }).parse();
    removeUnusedTypes(csf._ast.program, csf._ast);
    return printCsf(csf).code;
  };

  it('should remove unused Storybook types', async () => {
    const source = dedent`
      import { Button } from './Button';
      import { StoryFn, StoryObj, ComponentStory, Meta, MetaObj, ComponentMeta } from '@storybook/react';

      // unused types that should be removed
      type UnusedAlias = Meta<typeof Button>;
      type UnusedAlias2 = StoryObj<typeof Button>;
      type UnusedAlias3 = ComponentStory<typeof Button>;
      type UnusedAlias4 = ComponentMeta<typeof Button>;
      type UnusedDeepType = {
        foo: {
          bar: {
            story: StoryObj<typeof Button>;
          }
        }
      };
      interface UnusedInterface extends Meta {}
      interface UnusedDeepInterface {
        baz: {
          qux: {
            meta: Meta<typeof Button>;
          }
        }
      };

      export default { component: Button };
    `;
    const transformed = getTransformed(source);
    expect(getDiff(source, transformed)).toMatchInlineSnapshot(`
      import { Button } from './Button';
        
      - import { StoryFn, StoryObj, ComponentStory, Meta, MetaObj, ComponentMeta } from '@storybook/react';
      - 
        
        
      - // unused types that should be removed
      - type UnusedAlias = Meta<typeof Button>;
      - type UnusedAlias2 = StoryObj<typeof Button>;
      - type UnusedAlias3 = ComponentStory<typeof Button>;
      - type UnusedAlias4 = ComponentMeta<typeof Button>;
      - type UnusedDeepType = {
      -   foo: {
      -     bar: {
      -       story: StoryObj<typeof Button>;
      -     }
      -   }
      - };
      - interface UnusedInterface extends Meta {}
      - interface UnusedDeepInterface {
      -   baz: {
      -     qux: {
      -       meta: Meta<typeof Button>;
      -     }
      -   }
      - };
      - 
      - 
        export default { component: Button };
    `);
  });

  it('should not remove used Storybook types', async () => {
    const source = dedent`
      // Nothing in this file should be removed or modified
      import { StoryFn, StoryObj, ComponentStory, Meta, MetaObj, ComponentMeta } from '@storybook/react';
      import { Button } from './Button';

      type Alias = StoryFn<typeof Button>;
      type Alias2 = Alias & { b: string };
      type Story = StoryObj & { a: string };
      type DeepType = {
        foo: {
          bar: {
            story: ComponentStory<typeof Button>;
          }
        }
      };
      interface Interface extends Meta {}
      interface DeepInterface {
        baz: {
          qux: {
            meta: MetaObj<typeof Button>;
          }
        }
      };
      const X: ComponentMeta = {}

      function foo(a: Story, c: DeepType, d: Interface, e: DeepInterface){}

      export default {};
    `;

    const transformed = getTransformed(source);

    expect(transformed).toEqual(source);
  });
});
