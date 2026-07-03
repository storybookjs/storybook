type ButtonProps = {
	label?: string;
	onClick?: () => void;
	disabled?: boolean;
	iconOnly?: boolean;
};

export default function Button({
	label,
	onClick,
	disabled = false,
	iconOnly = false,
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			data-testid="button-component"
			style={{
				color: '#b0b0b0',
				backgroundColor: '#ffffff',
				border: '1px solid #ccc',
				padding: '8px 16px',
				display: 'inline-flex',
				alignItems: 'center',
				gap: 6,
			}}
		>
			{iconOnly ? (
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M8 1.2l1.9 3.8 4.2.6-3 2.9.7 4.2L8 10.9l-3.8 2 .7-4.2-3-2.9 4.2-.6L8 1.2z" />
				</svg>
			) : null}
			{label}
		</button>
	);
}
