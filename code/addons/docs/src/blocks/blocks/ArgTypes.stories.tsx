/** Custom docs page: {@link ./ArgTypes.mdx} (attached via `<Meta of={...} />`). */
import type { PlayFunctionContext } from 'storybook/internal/csf';

import type { Meta, StoryObj } from '@storybook/react-vite';

import * as ExampleStories from '../examples/ArgTypesParameters.stories';
import * as SubcomponentsExampleStories from '../examples/ArgTypesWithSubcomponentsParameters.stories';
import { ArgTypes } from './ArgTypes';

/** Stands in for a component that documentation names but no story file declares. */
const NeverStoried = () => null;

const meta = {
  title: 'Blocks/ArgTypes',
  component: ArgTypes,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: [
      '../examples/ArgTypesParameters.stories',
      '../examples/ArgTypesWithSubcomponentsParameters.stories',
    ],
    docsStyles: true,
  },
} satisfies Meta<typeof ArgTypes>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OfComponent: Story = {
  args: {
    of: ExampleStories.default.component,
  },
};

export const OfMeta: Story = {
  args: {
    of: ExampleStories.default,
  },
};

export const OfStory: Story = {
  args: {
    of: ExampleStories.NoParameters,
  },
};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    of: ExampleStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
};

/**
 * With the docgen server on, argTypes come from the service keyed by component id, and a component
 * no story file declares has no id to look up. The table says so instead of rendering nothing.
 */
export const OfComponentWithoutAStory: Story = {
  args: {
    of: NeverStoried,
  },
  beforeEach: async () => {
    // The block only consults the docgen service behind this feature, which is off by default here.
    const previousFeatures = globalThis.FEATURES;
    globalThis.FEATURES = { ...previousFeatures, experimentalDocgenServer: true };
    return () => {
      globalThis.FEATURES = previousFeatures;
    };
  },
};

export const OfStoryUnattached: Story = {
  parameters: { attached: false },
  args: {
    of: ExampleStories.NoParameters,
  },
};

export const IncludeProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    include: ['a'],
  },
};

export const IncludeParameter: Story = {
  args: {
    of: ExampleStories.Include,
  },
};

export const ExcludeProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    exclude: ['a'],
  },
};

export const ExcludeParameter: Story = {
  args: {
    of: ExampleStories.Exclude,
  },
};

export const SortProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    sort: 'alpha',
  },
};

export const SortParameter: Story = {
  args: {
    of: ExampleStories.Sort,
  },
};

export const Categories: Story = {
  args: {
    of: ExampleStories.Categories,
  },
};

const findSubcomponentTabs = async (
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  step: PlayFunctionContext['step']
) => {
  let subcomponentATab: HTMLElement | null = null;
  let subcomponentBTab: HTMLElement | null = null;
  await step('should have tabs for the subcomponents', async () => {
    subcomponentATab = await canvas.findByText('SubcomponentA');
    subcomponentBTab = await canvas.findByText('SubcomponentB');
  });
  return { subcomponentATab, subcomponentBTab };
};

export const SubcomponentsOfMeta: Story = {
  args: {
    of: SubcomponentsExampleStories.default,
  },
  play: async ({ canvas, step }) => {
    await findSubcomponentTabs(canvas, step);
  },
};

export const SubcomponentsOfStory: Story = {
  args: {
    of: SubcomponentsExampleStories.NoParameters,
  },
  play: async ({ canvas, step }) => {
    await findSubcomponentTabs(canvas, step);
  },
};

export const SubcomponentsIncludeProp: Story = {
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    include: ['a', 'f'],
  },
  play: async ({ canvas, step }) => {
    const { subcomponentBTab } = await findSubcomponentTabs(canvas, step);
    if (subcomponentBTab) {
      await (subcomponentBTab as HTMLElement & { click: () => Promise<void> }).click();
    }
  },
};

export const SubcomponentsExcludeProp: Story = {
  ...SubcomponentsIncludeProp,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    exclude: ['a', 'c', 'f', 'g'],
  },
};

export const SubcomponentsSortProp: Story = {
  ...SubcomponentsIncludeProp,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    sort: 'alpha',
  },
};
