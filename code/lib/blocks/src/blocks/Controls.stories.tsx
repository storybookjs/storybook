import React from 'react';

import type { PlayFunctionContext } from '@storybook/csf';
import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/test';

import * as ExampleStories from '../examples/ControlsParameters.stories';
import * as SubcomponentsExampleStories from '../examples/ControlsWithSubcomponentsParameters.stories';
import * as EmptyArgTypesStories from '../examples/EmptyArgTypes.stories';
import { Controls } from './Controls';

const meta = {
  component: Controls,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: [
      '../examples/ControlsParameters.stories',
      '../examples/EmptyArgTypes.stories',
      '../examples/ControlsWithSubcomponentsParameters.stories',
    ],
    docsStyles: true,
  },
} satisfies Meta<typeof Controls>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OfStory: Story = {
  args: {
    of: ExampleStories.NoParameters,
  },
};

// NOTE: this will throw with no of prop
export const OfStoryUnattached: Story = {
  parameters: { attached: false },
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

export const SubcomponentsOfStory: Story = {
  args: {
    of: SubcomponentsExampleStories.NoParameters,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await findSubcomponentTabs(canvas, step);
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

/**
 * When a story is defined without any argTypes or args, the Docs UI should not display the control
 * component.
 */
export const EmptyArgTypes: Story = {
  args: {
    of: EmptyArgTypesStories.Default,
  },
};
