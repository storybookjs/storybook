type StatusPillProps = {
	label: string;
	tone?: 'neutral' | 'success';
};

export default function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
	const backgroundColor = tone === 'success' ? '#d1fae5' : '#e5e7eb';
	const color = tone === 'success' ? '#065f46' : '#374151';

	return (
		<span
			data-testid="status-pill"
			style={{
				display: 'inline-block',
				padding: '4px 8px',
				borderRadius: '999px',
				fontSize: '12px',
				fontWeight: 600,
				backgroundColor,
				color,
			}}
		>
			{label}
		</span>
	);
}
