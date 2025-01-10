import { expect, fn, userEvent, within } from '@storybook/test';

import type { StoryFn as CSF2Story, Meta, StoryObj } from '../..';
import AddWrapperDecorator from './AddWrapperDecorator.svelte';
import Button from './Button.svelte';
import CustomRenderComponent from './CustomRenderComponent.svelte';
import InputFilledStoryComponent from './InputFilledStoryComponent.svelte';
import LoaderStoryComponent from './LoaderStoryComponent.svelte';
import StoryWithLocaleComponent from './StoryWithLocaleComponent.svelte';

const meta = {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
    },
  },
  excludeStories: /.*ImNotAStory$/,
} satisfies Meta<Button>;

export default meta;
type CSF3Story = StoryObj<typeof meta>;

// For testing purposes. Should be ignored in ComposeStories
export const ImNotAStory = 123;

const Template: CSF2Story = (args) => ({
  Component: Button,
  props: args,
});

export const CSF2Secondary = Template.bind({});
CSF2Secondary.args = {
  label: 'label coming from story args!',
  primary: false,
};

const getCaptionForLocale = (locale: string) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'pt':
      return 'Olá!';
    default:
      return 'Hello!';
  }
};

// @ts-expect-error -- incompatibility with Svelte 5 types and CSF
export const CSF2StoryWithLocale: CSF2Story<typeof StoryWithLocaleComponent> = (
  args,
  { globals }
) => ({
  Component: StoryWithLocaleComponent,
  props: {
    ...args,
    locale: globals.locale,
    label: getCaptionForLocale(globals.locale),
  },
});
CSF2StoryWithLocale.storyName = 'WithLocale';

export const CSF2StoryWithParamsAndDecorator = Template.bind({});
CSF2StoryWithParamsAndDecorator.args = {
  label: 'foo',
};
CSF2StoryWithParamsAndDecorator.parameters = {
  layout: 'centered',
};
CSF2StoryWithParamsAndDecorator.decorators = [
  () => ({
    Component: AddWrapperDecorator,
  }),
];

export const NewStory: CSF3Story = {
  args: {
    label: 'foo',
    size: 'large',
    primary: true,
  },
  decorators: [
    () => ({
      Component: AddWrapperDecorator,
    }),
  ],
};

export const CSF3Primary: CSF3Story = {
  args: {
    label: 'foo',
    size: 'large',
    primary: true,
  },
};

export const CSF3Button: CSF3Story = {
  args: { label: 'foo' },
};

export const CSF3ButtonWithRender: StoryObj<CustomRenderComponent> = {
  args: {
    buttonProps: CSF3Button.args,
  },
  render: (args) => ({
    Component: CustomRenderComponent,
    props: {
      buttonProps: args.buttonProps,
    },
  }),
};

export const CSF3InputFieldFilled: StoryObj<typeof InputFilledStoryComponent> = {
  render: () =>
    ({
      Component: InputFilledStoryComponent,
    }) as any,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Step label', async () => {
      const inputEl = canvas.getByTestId('input');
      await userEvent.type(inputEl, 'Hello world!');
      await expect(inputEl).toHaveValue('Hello world!');
    });
  },
};

const mockFn = fn();
export const LoaderStory: StoryObj<typeof LoaderStoryComponent> = {
  args: {
    mockFn,
  } as any,
  loaders: [
    async () => {
      mockFn.mockReturnValueOnce('mockFn return value');
      return {
        value: 'loaded data',
      };
    },
  ],
  render: (args, { loaded }) =>
    ({
      Component: LoaderStoryComponent,
      props: {
        ...args,
        loaded,
      },
    }) as any,
  play: async () => {
    expect(mockFn).toHaveBeenCalledWith('render');
  },
};
