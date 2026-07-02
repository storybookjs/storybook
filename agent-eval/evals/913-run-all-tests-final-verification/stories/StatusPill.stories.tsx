import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import StatusPill from '../src/components/StatusPill';

const meta = {
	title: 'Example/StatusPill',
	component: StatusPill,
	tags: ['test'],
	args: {
		label: 'Ready',
		tone: 'neutral',
	},
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getByText('Ready')).toBeInTheDocument();
	},
};

export const Success: Story = {
	args: {
		label: 'Completed',
		tone: 'success',
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText('Completed')).toBeInTheDocument();
	},
};
