import type { ReactNode } from 'react';
import { View, Text, Badge, Button } from 'reshaped';

export type PlanCardProps = {
	name: string;
	price: string;
	features: string[];
	ctaLabel: string;
	popular?: boolean;
	onSelect?: () => void;
	footer?: ReactNode;
};

export default function PlanCard({
	name,
	price,
	features,
	ctaLabel,
	popular = false,
	onSelect,
	footer,
}: PlanCardProps) {
	return (
		<View
			borderColor={popular ? 'primary' : 'neutral-faded'}
			border={true}
			borderRadius="medium"
			padding={4}
			shadow={popular ? 'raised' : undefined}
			backgroundColor="elevation-base"
			attributes={{ 'data-testid': 'plan-card' }}
		>
			<View gap={3} direction="column">
				<View direction="row" justify="space-between" align="start">
					<View gap={1} direction="column">
						<Text variant="title-5" weight="bold">
							{name}
						</Text>
						<Text variant="body-2" color="neutral-faded">
							{price}
						</Text>
					</View>
					{popular ? (
						<Badge color="primary" variant="faded" size="small" rounded>
							Popular
						</Badge>
					) : null}
				</View>

				<ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
					{features.map((feature) => (
						<li key={feature}>
							<Text variant="body-2" color="neutral">
								{feature}
							</Text>
						</li>
					))}
				</ul>

				<Button
					color="primary"
					onClick={onSelect}
					attributes={{ 'data-testid': 'plan-cta' }}
					fullWidth
				>
					{ctaLabel}
				</Button>

				{footer ? (
					<Text variant="caption-1" color="neutral-faded">
						{footer}
					</Text>
				) : null}
			</View>
		</View>
	);
}
