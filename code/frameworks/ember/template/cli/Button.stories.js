import { fn } from '@storybook/test';

import { action } from '@storybook/addon-actions';
import { linkTo } from '@storybook/addon-links';

import { hbs } from 'ember-cli-htmlbars';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'Example/Button',
  render: (args) => ({
    template: hbs`<button {{on "click" this.onClick}}>{{this.label}}</button>`,
    context: args,
  }),
  argTypes: {
    label: { control: 'text' },
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/ember/writing-docs/autodocs
  tags: ['autodocs'],
  args: { onClick: fn() },
};

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Text = {
  args: {
    label: 'Button',
  },
};

export const Emoji = {
  args: {
    label: '😀 😎 👍 💯',
  },
};

export const TextWithAction = {
  render: () => ({
    template: hbs`
    <button {{on "click" this.onClick}}>
      Trigger Action
    </button>
  `,
    context: {
      onClick: () => action('This was clicked')(),
    },
  }),
  name: 'With an action',
  parameters: {
    notes: 'My notes on a button with emojis',
  },
};

export const ButtonWithLinkToAnotherStory = {
  render: () => ({
    template: hbs`
    <button {{on "click" this.onClick}}>
      Go to Welcome Story
    </button>
  `,
    context: {
      onClick: linkTo('example-button--docs'),
    },
  }),
  name: 'button with link to another story',
};
