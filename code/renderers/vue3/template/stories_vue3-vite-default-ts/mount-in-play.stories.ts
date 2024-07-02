import type { StoryObj } from '@storybook/vue3';
import { defineComponent } from 'vue';

const Button = defineComponent({
  template: '<button :disabled="disabled">{{label}}</button>',
  props: ['disabled', 'label'],
});

export default {
  component: Button,
};

export const Basic: StoryObj<typeof Button> = {
  args: {
    disabled: true,
  },
  async play({ mount, args }) {
    await mount(Button, { props: { ...args, label: 'set in play' } });
  },
};
