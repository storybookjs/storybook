import { userEvent, within, expect, fn } from '@storybook/test';
import type { Meta, StoryFn as CSF2Story, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    backgroundColor: { control: 'color' },
    onClick: { action: 'clicked' },
  },
  args: { primary: false },
  excludeStories: /.*ImNotAStory$/,
} as Meta<typeof Button>;

export default meta;
type CSF3Story = StoryObj<typeof meta>;

// For testing purposes. Should be ignored in ComposeStories
export const ImNotAStory = 123;

const Template: CSF2Story = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
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
  components: { Button },
  setup() {
    const label = getCaptionForLocale(globals.locale);
    return { args: { ...args, label } };
  },
  template: `<div>
    <p>locale: ${globals.locale}</p>
    <Button v-bind="args" label="${getCaptionForLocale(globals.locale)}" />
  </div>`,
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
  () => ({ template: '<div style="margin: 3em;"><story/></div>' }),
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
  render: (args) => ({
    components: { Button },
    setup() {
      console.log('hello')
      return { args };
    },
    template: `
      <div>
        <p data-testid="custom-render">I am a custom render function</p>
        <Button v-bind="args" />
      </div>
    `,
  }),
};

export const CSF3InputFieldFilled: CSF3Story = {
  ...CSF3Button,
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
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
export const WithLoader: StoryObj<{ mockFn: (val: string) => string }> = {
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
    components: { Button },
    setup() {
      return { args, data: args.mockFn('render'), loaded: loaded.value };
    },
    template: `
      <div>
        <div data-testid="loaded-data">{{loaded}}</div>
        <div data-testid="mock-data">{{data}}</div>
      </div>
    `,
  }),
  play: async () => {
    expect(mockFn).toHaveBeenCalledWith('render');
  },
};

