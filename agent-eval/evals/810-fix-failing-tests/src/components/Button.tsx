type ButtonProps = {
	label: string;
	onClick?: () => void;
	disabled?: boolean;
};

export default function Button({ label, disabled = false }: ButtonProps) {
	return (
		<button type="button" disabled={disabled} data-testid="button-component">
			{label}
		</button>
	);
}
