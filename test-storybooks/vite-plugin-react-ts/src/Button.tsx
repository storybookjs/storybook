import type { ReactElement } from 'react';

export interface ButtonProps {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export function Button({ label, primary = false, onClick }: ButtonProps): ReactElement {
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
