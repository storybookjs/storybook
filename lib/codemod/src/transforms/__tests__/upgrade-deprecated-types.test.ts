import { describe, expect, it } from 'vitest';

import ansiRegex from 'ansi-regex';
import type { API } from 'jscodeshift';
import { dedent } from 'ts-dedent';

import _transform from '../upgrade-deprecated-types';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

const tsTransform = async (source: string) =>
  (
    await _transform({ source, path: 'Component.stories.tsx' }, {} as API, {
      parser: 'tsx',
    })
  ).trim();

describe('upgrade-deprecated-types', () => {
  describe('typescript', () => {
    it('upgrade regular imports', async () => {
      await expect(
        tsTransform(dedent`
          import { Story, ComponentMeta, Meta, ComponentStory, ComponentStoryObj, ComponentStoryFn } from '@storybook/react';
          import { Cat, CatProps } from './Cat';
            
          const meta = { title: 'Cat', component: Cat } satisfies ComponentMeta<typeof Cat>
          const meta2: Meta<CatProps> = { title: 'Cat', component: Cat };
          export default meta;
          
          export const A: ComponentStory<typeof Cat> = (args) => <Cat {...args} />;
          export const B: any = (args) => <Button {...args} />;
          export const C: ComponentStoryFn<typeof Cat> = (args) => <Cat {...args} />;
          export const D: ComponentStoryObj<typeof Cat> = {
            args: {
              name: 'Fluffy',
            },
          };
          export const E: Story<CatProps> = (args) => <Cat {...args} />;
        `)
      ).resolves.toMatchSnapshot();
    });

    it('upgrade imports with local names', async () => {
      await expect(
        tsTransform(dedent`
          import { Story as Story_, ComponentMeta as ComponentMeta_, ComponentStory as Story__, ComponentStoryObj as ComponentStoryObj_, ComponentStoryFn as StoryFn_ } from '@storybook/react';
          import { Cat } from './Cat';
            
          const meta = { title: 'Cat', component: Cat } satisfies ComponentMeta_<typeof Cat>
          const meta2: ComponentMeta_<typeof Cat> = { title: 'Cat', component: Cat };
          export default meta;
          
          export const A: Story__<typeof Cat> = (args) => <Cat {...args} />;
          export const B: any = (args) => <Button {...args} />;
          export const C: StoryFn_<typeof Cat> = (args) => <Cat {...args} />;
          export const D: ComponentStoryObj_<typeof Cat> = {
            args: {
              name: 'Fluffy',
            },
          };
          export const E: Story_<CatProps> = (args) => <Cat {...args} />;
        `)
      ).resolves.toMatchSnapshot();
    });

    it('upgrade imports with conflicting local names', async () => {
      await expect.addSnapshotSerializer({
        serialize: (value) => {
          const stringVal = typeof value === 'string' ? value : value.toString();
          return stringVal.replace(ansiRegex(), '');
        },
        test: () => true,
      });

      await expect(() =>
        tsTransform(dedent`
          import { ComponentMeta as Meta, ComponentStory as StoryFn } from '@storybook/react';
          import { Cat } from './Cat';
            
          const meta = { title: 'Cat', component: Cat } satisfies Meta<typeof Cat>
          export default meta;
          
          export const A: StoryFn<typeof Cat> = (args) => <Cat {...args} />;
         
        `)
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('upgrade namespaces', async () => {
      await expect(
        tsTransform(dedent`
          import * as SB from '@storybook/react';
          import { Cat, CatProps } from './Cat';
  
          const meta = { title: 'Cat', component: Cat } satisfies SB.ComponentMeta<typeof Cat>;
          const meta2: SB.ComponentMeta<typeof Cat> = { title: 'Cat', component: Cat };
          export default meta;
  
          export const A: SB.ComponentStory<typeof Cat> = (args) => <Cat {...args} />;
          export const B: any = (args) => <Button {...args} />;
          export const C: SB.ComponentStoryFn<typeof Cat> = (args) => <Cat {...args} />;
          export const D: SB.ComponentStoryObj<typeof Cat> = {
            args: {
              name: 'Fluffy',
            },
          };
          export const E: SB.Story<CatProps> = (args) => <Cat {...args} />;
          
        `)
      ).resolves.toMatchSnapshot();
    });
  });
});
