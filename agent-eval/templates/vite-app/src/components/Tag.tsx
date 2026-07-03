export type TagProps = {
	label: string;
	tone?: 'neutral' | 'positive' | 'notice';
};

const TONE_COLORS = {
	neutral: { background: '#f3f4f6', color: '#374151' },
	positive: { background: '#dcfce7', color: '#166534' },
	notice: { background: '#fef9c3', color: '#854d0e' },
} as const;

export default function Tag({ label, tone = 'neutral' }: TagProps) {
	const colors = TONE_COLORS[tone];

	return (
		<span
			style={{
				backgroundColor: colors.background,
				borderRadius: 4,
				color: colors.color,
				display: 'inline-block',
				fontSize: 12,
				fontWeight: 600,
				padding: '2px 8px',
				textTransform: 'uppercase',
			}}
		>
			{label}
		</span>
	);
}
