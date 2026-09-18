import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * A label to show on the button
   */
  label: string;
}

export const Button = ({ label = 'Hello', ...props }: ButtonProps) => (
  <button type="button" {...props}>
    {label}
  </button>
);
