import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within, expect } from 'storybook/test';

import { Card } from './Card';

type Story = StoryObj<typeof Card>;

const meta: Meta<typeof Card> = {
	component: Card,
	args: {
		title: 'Sample Card',
		imageUrl: 'https://picsum.photos/300/200',
		imageAlt: 'Sample image',
		content: 'This is some sample content for the card component.',
		actionText: 'Learn More',
		onClick: fn(),
	},
};

export default meta;

export const Default: Story = {};

export const LongContent: Story = {
	args: {
		title: 'Card with Long Content',
		content:
			'This is a card with much longer content to demonstrate how the component handles text that spans multiple lines. The card should expand to accommodate this content while maintaining its visual structure.',
	},
};

export const WithInteraction: Story = {
	name: 'Button Click Works',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button');

		await userEvent.click(button);

		await expect(args.onClick).toHaveBeenCalled();
	},
};
