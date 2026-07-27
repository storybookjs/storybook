import { accentColor, neutralColor } from '../theme/colors';

export type StatusPillProps = {
	label: string;
	active?: boolean;
};

export default function StatusPill({ label, active = false }: StatusPillProps) {
	const border = active ? accentColor : neutralColor;

	return (
		<span
			data-testid="status-pill"
			style={{
				border: `2px solid ${border}`,
				color: border,
				borderRadius: 6,
				display: 'inline-block',
				fontSize: 13,
				padding: '4px 12px',
			}}
		>
			{label}
		</span>
	);
}
