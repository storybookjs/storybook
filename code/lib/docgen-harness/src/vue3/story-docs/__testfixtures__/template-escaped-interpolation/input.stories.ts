import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateEscapedInterpolation from './TemplateEscapedInterpolation.vue';

const meta = {
  component: TemplateEscapedInterpolation,
  title: 'Forms/template-escaped-interpolation',
} satisfies Meta<typeof TemplateEscapedInterpolation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: '<em>1 & 2</em>',
  },
  render: (args) => ({
    components: { TemplateEscapedInterpolation },
    setup: () => ({ args }),
    template: '<TemplateEscapedInterpolation>{{ args.label }}</TemplateEscapedInterpolation>',
  }),
};
