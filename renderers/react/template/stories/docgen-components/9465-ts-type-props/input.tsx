import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
};

const Component = ({ disabled = false, children }: Props) => (
  <button disabled={disabled}>{children}</button>
);

export const component = Component;
