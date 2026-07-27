import type { Meta, StoryObj } from '@storybook/react';
import ReviewCard from '../src/components/ReviewCard';

const meta = {
	title: 'Reviews/ReviewCard',
	component: ReviewCard,
	args: {
		author: 'Avery Doe',
		rating: 4,
		comment: 'Great product, quick support response, would recommend.',
	},
} satisfies Meta<typeof ReviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLongComment: Story = {
	args: {
		comment:
			'I was skeptical at first, but this worked really well for our team. The onboarding took a day, and we were productive right away. Highly recommended for small teams.',
	},
};

export const LowRating: Story = {
	args: {
		rating: 2,
		comment: 'Functionality is okay, but performance can be improved.',
	},
};
