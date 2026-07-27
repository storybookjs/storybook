import type { Meta, StoryObj } from '@storybook/react';
import PlanCard from '../src/components/PlanCard';

const meta = {
	title: 'Pricing/PlanCard',
	component: PlanCard,
	args: {
		name: 'Starter',
		pricePerMonth: '$12/mo',
		features: ['1 project', 'Email support', 'Basic analytics'],
		ctaText: 'Choose Plan',
		popular: true,
	},
} satisfies Meta<typeof PlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		name: 'Starter',
		pricePerMonth: '$12/mo',
		ctaText: 'Choose Plan',
	},
};

export const Popular: Story = {
	args: {
		name: 'Growth',
		pricePerMonth: '$29',
		ctaText: 'Upgrade',
		popular: true,
		features: ['Unlimited projects', 'Priority support', 'Reports'],
	},
};

export const ManyFeatures: Story = {
	args: {
		name: 'Enterprise',
		pricePerMonth: '$99',
		ctaText: 'Contact Sales',
		features: [
			'Unlimited seats',
			'SSO',
			'Custom roles',
			'Dedicated success manager',
			'Advanced analytics',
		],
		popular: false,
	},
};
