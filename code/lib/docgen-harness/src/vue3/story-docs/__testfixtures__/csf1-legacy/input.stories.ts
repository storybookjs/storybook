import type { Meta, StoryFn } from '@storybook/vue3';

import CsfOneButton from './CsfOneButton.vue';

const meta = {
  component: CsfOneButton,
  title: 'Forms/csf1-legacy',
} satisfies Meta<typeof CsfOneButton>;

export default meta;

const Template: StoryFn<typeof CsfOneButton> = (args) => ({
  components: { CsfOneButton },
  setup: () => ({ args }),
  template: '<CsfOneButton v-bind="args" />',
});

export const Primary = Template.bind({});
Primary.args = {
  label: 'Legacy',
};
