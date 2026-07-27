import { View, Text } from 'reshaped';

export type ReviewCardProps = {
	author: string;
	rating: number;
	comment: string;
};

export default function ReviewCard({ author, rating, comment }: ReviewCardProps) {
	const clamped = Math.min(5, Math.max(0, rating));

	return (
		<View
			borderColor="neutral-faded"
			border={true}
			borderRadius="medium"
			padding={3}
			backgroundColor="elevation-base"
			attributes={{ 'data-testid': 'review-card' }}
		>
			<View gap={2} direction="column">
				<View direction="row" justify="space-between" align="center">
					<Text variant="body-2" weight="bold" attributes={{ 'data-testid': 'review-author' }}>
						{author}
					</Text>
					<Text
						variant="body-2"
						attributes={{
							'data-testid': 'review-rating',
							'aria-label': `${clamped} out of 5`,
						}}
					>
						{'★'.repeat(clamped)}
						{'☆'.repeat(5 - clamped)}
					</Text>
				</View>
				<Text
					variant="body-2"
					color="neutral-faded"
					as="p"
					attributes={{
						'data-testid': 'review-comment',
						style: { margin: 0 },
					}}
				>
					{comment}
				</Text>
			</View>
		</View>
	);
}
