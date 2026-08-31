import type { Meta, StoryObj } from '@storybook/vue3';

import TsEnumProps from './TsEnumProps.vue';
import { Severity } from './severity.ts';

const meta = {
  title: 'VueFixtures/TsEnumProps',
  component: TsEnumProps,
} satisfies Meta<typeof TsEnumProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { severity: Severity.Warning, level: 1 },
};
