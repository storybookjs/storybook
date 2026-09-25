export interface ButtonProps {
  /** Text shown inside the button */
  label: string;
  /** Use the primary visual style */
  primary?: boolean;
  onClick?: () => void;
}

export function Button({ label, primary = false, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid #ccc',
        cursor: 'pointer',
        background: primary ? '#029cfd' : 'transparent',
        color: primary ? 'white' : 'inherit',
      }}
    >
      {label}
    </button>
  );
}
