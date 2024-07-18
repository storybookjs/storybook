import { expect, fn, userEvent, within } from '@storybook/test';
import { Meta, StoryFn as CSF2Story, StoryObj, componentWrapperDecorator } from '../..';

import { ButtonComponent } from './button.component';

const meta = {
  title: 'Example/Button',
  component: ButtonComponent,
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    backgroundColor: { control: 'color' },
    onClick: { action: 'clicked' },
  },
  args: { primary: false },
  excludeStories: /.*ImNotAStory$/,
} as Meta<ButtonComponent>;

export default meta;
type CSF3Story = StoryObj<ButtonComponent>;

// For testing purposes. Should be ignored in ComposeStories
export const ImNotAStory = 123;

const Template: CSF2Story = (args) => ({
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
    case 'en':
      return 'Hello!';
    default:
      return undefined;
  }
};

export const CSF2StoryWithLocale: CSF2Story = (args, { globals }) => ({
  props: {
    ...args,
    label: getCaptionForLocale(globals.locale),
    locale: globals.locale,
  },
});
CSF2StoryWithLocale.storyName = 'WithLocale';
CSF2StoryWithLocale.decorators = [
  componentWrapperDecorator((story) => `<div><p>locale: {{ locale }}</p>${story}</div>`),
];

export const CSF2StoryWithParamsAndDecorator = Template.bind({});
CSF2StoryWithParamsAndDecorator.args = {
  label: 'foo',
};
CSF2StoryWithParamsAndDecorator.parameters = {
  layout: 'centered',
};
CSF2StoryWithParamsAndDecorator.decorators = [
  componentWrapperDecorator((story) => `<div style="margin: 3em;">${story}</div>`),
];

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

export const CSF3ButtonWithRender: CSF3Story = {
  ...CSF3Button,
  decorators: [
    componentWrapperDecorator(
      (story) => `<div>
        <p data-testid="custom-render">I am a custom render function</p>
        ${story}
      </div>`
    ),
  ],
};

export const CSF3InputFieldFilled: CSF3Story = {
  ...CSF3Button,
  render: (args) => ({
    props: args,
    template: '<input data-testid="input" />',
  }),
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
export const LoaderStory: StoryObj<{ mockFn: (val: string) => string }> = {
  args: {
    mockFn,
  },
  loaders: [
    async () => {
      mockFn.mockReturnValueOnce('mockFn return value');
      return {
        value: 'loaded data',
      };
    },
  ],
  render: (args, { loaded }) => ({
    props: { args, data: args.mockFn('render'), loaded: loaded.value },
    template: `
      <div>
        <div data-testid="loaded-data">{{ loaded }}</div>
        <div data-testid="spy-data">{{ data }}</div>
      </div>
    `,
  }),
  play: async () => {
    expect(mockFn).toHaveBeenCalledWith('render');
  },
};
