type ButtonProps = {
	label: string;
	onClick?: () => void;
	disabled?: boolean;
};

export default function Button({ label, onClick, disabled = false }: ButtonProps) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} data-testid="button-component">
			{label}
		</button>
	);
}
