import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ArgTypes } from './ArgTypes';
import * as ExampleStories from '../examples/ArgTypesParameters.stories';
import * as SubcomponentsExampleStories from '../examples/ArgTypesWithSubcomponentsParameters.stories';
import { within } from '@storybook/test';
import type { PlayFunctionContext } from '@storybook/csf';

const meta: Meta<typeof ArgTypes> = {
  title: 'Blocks/ArgTypes',
  component: ArgTypes,
  parameters: {
    relativeCsfPaths: [
      '../examples/ArgTypesParameters.stories',
      '../examples/ArgTypesWithSubcomponentsParameters.stories',
    ],
    docsStyles: true,
  },
};
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
    // eslint-disable-next-line import/namespace
    of: ExampleStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
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
  canvas: ReturnType<typeof within>,
  step: PlayFunctionContext['step']
) => {
  let subcomponentATab: HTMLElement;
  let subcomponentBTab: HTMLElement;
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await findSubcomponentTabs(canvas, step);
  },
};

export const SubcomponentsOfStory: Story = {
  ...SubcomponentsOfMeta,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
  },
};

export const SubcomponentsIncludeProp: Story = {
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    include: ['a', 'f'],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const { subcomponentBTab } = await findSubcomponentTabs(canvas, step);
    await subcomponentBTab.click();
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
