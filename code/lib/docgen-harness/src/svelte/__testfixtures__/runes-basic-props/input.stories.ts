import type { Meta, StoryObj } from '@storybook/svelte';

import Panel from './Panel.svelte';

const meta = {
  title: 'SvelteFixtures/PanelPlain',
  component: Panel,
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Default label', count: 0, primary: false, title: undefined },
};

export const AllArgs: Story = {
  args: { label: 'All values', count: 3, primary: true, title: 'Panel title' },
};
