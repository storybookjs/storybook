import React from 'react';

export interface ButtonProps {
  /** Text inside the button. */
  label: string;
  /** Visual weight. */
  variant?: 'primary' | 'secondary';
}

export function Button({ label, variant = 'primary' }: ButtonProps): React.ReactElement {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      style={{
        padding: '8px 16px',
        border: '1px solid #029cfd',
        borderRadius: 4,
        font: '600 14px/16px system-ui, sans-serif',
        color: isPrimary ? '#fff' : '#029cfd',
        background: isPrimary ? '#029cfd' : 'transparent',
      }}
    >
      {label}
    </button>
  );
}
