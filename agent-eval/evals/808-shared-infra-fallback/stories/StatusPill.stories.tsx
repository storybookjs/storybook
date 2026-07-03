import type { Meta, StoryObj } from '@storybook/react';
import StatusPill from '../src/components/StatusPill';

const meta = {
	title: 'Example/StatusPill',
	component: StatusPill,
	args: {
		label: 'Draft',
	},
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {};

export const Active: Story = {
	args: {
		label: 'Published',
		active: true,
	},
};
