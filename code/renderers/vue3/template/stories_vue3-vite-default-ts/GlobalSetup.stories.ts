import { expect, within } from '@storybook/test';
import type { Meta, StoryObj } from '@storybook/vue3';

import { inject } from 'vue';

import GlobalSetup from './GlobalSetup.vue';

const meta: Meta = {
  component: GlobalSetup,
  argTypes: {},
  render: (args: any) => ({
    // Components used in your story `template` are defined in the `components` object
    components: { GlobalUsage: GlobalSetup },
    // The story's `args` need to be mapped into the template through the `setup()` method
    setup() {
      const color = inject('someColor', 'red'); // <-- this is the global setup from .storybook/preview.ts
      return { args: { ...args, backgroundColor: color } };
    },
    // And then the `args` are bound to your component with `v-bind="args"`
    template: '<global-usage v-bind="args" />',
  }),
} satisfies Meta<typeof GlobalSetup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    primary: true,
    label: 'someColor injected from .storybook/preview.ts',
  },
  play: async ({ canvasElement, id }) => {
    const canvas = within(canvasElement);

    const button = await canvas.getByRole('button');
    await expect(button).toHaveStyle('background-color: rgb(0, 128, 0)'); // <-- this provide themeColor = green from .storybook/preview.ts

    const h2 = await canvas.getByRole('heading', { level: 2 });
    await expect(h2).toHaveTextContent('Hi Story! from some plugin your name is Primary!');

    const h3 = await canvas.getByRole('heading', { level: 3 });
    await expect(h3).toHaveTextContent('Hello Story! from some plugin your name is Primary!');

    const h4 = await canvas.getByRole('heading', { level: 4 });
    await expect(h4).toHaveTextContent('Welcome Story! from some plugin your name is Primary!');
  },
};

export const Secondary: Story = {
  args: {
    label: 'someColor injected from .storybook/preview.ts',
  },
};
