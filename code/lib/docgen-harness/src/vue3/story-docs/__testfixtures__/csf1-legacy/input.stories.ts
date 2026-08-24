import type { Meta, StoryFn, StoryObj } from '@storybook/vue3';

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

export const AssignedArgs: StoryObj<typeof meta> = {};
AssignedArgs.args = {
  label: 'Assigned',
};

export const AssignedArgsOverrideInline: StoryObj<typeof meta> = {
  args: { label: 'Inline' },
};
AssignedArgsOverrideInline.args = {
  label: 'Assigned wins',
};
