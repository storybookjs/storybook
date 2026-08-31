import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './ts-enum-props/component.vue';
import { Severity } from './ts-enum-props/severity';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

/**
 * Under the "vue-component-meta" docgen plugin, the enum-backed props get a Controls dropdown
 * listing the member names (Severity.Info, Level.Low) while setting the runtime values they
 * stand for ('info', 0). The literal-union prop next to them is the unlabelled comparison.
 */
export const TsEnumProps: Story = {
  args: {
    severity: Severity.Warning,
    level: 1,
    size: 'medium',
  },
};
