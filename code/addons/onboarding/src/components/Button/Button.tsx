import type { ComponentProps } from 'react';
import React, { forwardRef } from 'react';
import { styled } from 'storybook/internal/theming';

export interface ButtonProps extends ComponentProps<'button'> {
  children: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'white';
}

const StyledButton = styled.button<{ variant: ButtonProps['variant'] }>`
  all: unset;
  box-sizing: border-box;
  border: 0;
  border-radius: 0.25rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.75rem;
  background: ${({ theme, variant }) => {
    if (variant === 'primary') return theme.color.secondary;
    if (variant === 'secondary') return theme.color.lighter;
    if (variant === 'outline') return 'transparent';
    if (variant === 'white') return theme.color.lightest;
    return theme.color.secondary;
  }};
  color: ${({ theme, variant }) => {
    if (variant === 'primary') return theme.color.lightest;
    if (variant === 'secondary') return theme.darkest;
    if (variant === 'outline') return theme.darkest;
    if (variant === 'white') return theme.color.secondary;
    return theme.color.lightest;
  }};
  box-shadow: ${({ variant }) => {
    if (variant === 'secondary') return '#D9E8F2 0 0 0 1px inset';
    if (variant === 'outline') return '#D9E8F2 0 0 0 1px inset';
    return 'none';
  }};
  height: 32px;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: ${({ theme }) => theme.typography.fonts.base};
  transition: background-color, box-shadow, color, opacity;
  transition-duration: 0.16s;
  transition-timing-function: ease-in-out;
  text-decoration: none;

  &:hover {
    background-color: ${({ theme, variant }) => {
      if (variant === 'primary') return '#0b94eb';
      if (variant === 'secondary') return '#eef4f9';
      if (variant === 'outline') return 'transparent';
      if (variant === 'white') return theme.color.lightest;
      return '#0b94eb';
    }};
    color: ${({ theme, variant }) => {
      if (variant === 'primary') return theme.color.lightest;
      if (variant === 'secondary') return theme.darkest;
      if (variant === 'outline') return theme.darkest;
      if (variant === 'white') return theme.color.darkest;
      return theme.color.lightest;
    }};
  }

  &:focus {
    box-shadow: ${({ variant }) => {
      if (variant === 'primary') return 'inset 0 0 0 1px rgba(0, 0, 0, 0.2)';
      if (variant === 'secondary') return 'inset 0 0 0 1px #0b94eb';
      if (variant === 'outline') return 'inset 0 0 0 1px #0b94eb';
      if (variant === 'white') return 'none';
      return 'inset 0 0 0 2px rgba(0, 0, 0, 0.1)';
    }};
  }
`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, onClick, variant = 'primary', ...rest },
  ref
) {
  return (
    <StyledButton ref={ref} onClick={onClick} variant={variant} {...rest}>
      {children}
    </StyledButton>
  );
});
