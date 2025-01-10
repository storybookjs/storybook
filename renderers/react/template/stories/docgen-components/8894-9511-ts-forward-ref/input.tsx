import React, { forwardRef } from 'react';

interface ButtonProps {
  /** Sets the button size. */
  variant?: 'small' | 'large';
  /** Disables the button. */
  disabled?: boolean;
  /** Content of the button. */
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { disabled = false, variant = 'small', children },
  ref
) {
  return (
    <button type="button" disabled={disabled} ref={ref}>
      {children} {variant}
    </button>
  );
});

export default Button;

export const component = Button;
