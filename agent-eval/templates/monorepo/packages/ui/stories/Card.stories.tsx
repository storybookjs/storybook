import type { Meta, StoryObj } from '@storybook/react';
import Card from '../src/components/Card';

const meta = {
	title: 'UI/Card',
	component: Card,
	args: {
		title: 'Release notes',
		children: 'Everything that changed this week.',
	},
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Flush: Story = {
	args: {
		padded: false,
	},
};
