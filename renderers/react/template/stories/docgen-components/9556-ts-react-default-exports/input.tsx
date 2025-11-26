import React from 'react';

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDisabled?: boolean;
}

export const Button: React.FC<Props> = ({ isDisabled = false, ...props }: Props) => (
  <button disabled={isDisabled} {...props} />
);

export const component = Button;
