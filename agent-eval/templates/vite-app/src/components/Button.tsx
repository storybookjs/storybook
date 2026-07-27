export type ButtonProps = {
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'secondary';
};

export default function Button({
	label,
	onClick,
	disabled = false,
	variant = 'primary',
}: ButtonProps) {
	const background = variant === 'primary' ? '#1d4ed8' : '#e5e7eb';
	const color = variant === 'primary' ? '#ffffff' : '#111827';

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			style={{
				backgroundColor: background,
				border: 'none',
				borderRadius: 6,
				color,
				cursor: disabled ? 'not-allowed' : 'pointer',
				fontSize: 14,
				fontWeight: 600,
				opacity: disabled ? 0.6 : 1,
				padding: '8px 16px',
			}}
		>
			{label}
		</button>
	);
}
