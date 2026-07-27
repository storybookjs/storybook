import type { Meta, StoryObj } from '@storybook/react';
import Button from '../src/components/Button';

const meta = {
	title: 'Example/Button',
	component: Button,
	tags: ['test'],
	args: {
		label: 'Click me',
		disabled: false,
	},
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const IconOnly: Story = {
	args: {
		label: undefined,
		iconOnly: true,
	},
};
