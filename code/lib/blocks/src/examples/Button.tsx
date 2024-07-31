import React from 'react';
import { styled } from 'storybook/internal/theming';

interface ButtonProps {
  /**
   * Is this the principal call to action on the page?
   */
  primary?: boolean;
  /**
   * What background color to use
   */
  backgroundColor?: string;
  /**
   * How large should the button be?
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Button contents
   */
  label: string;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

const StyledButton = styled.button<Omit<ButtonProps, 'label' | 'onClick'>>(
  ({ primary, size, backgroundColor }) => {
    const modeStyles = primary
      ? {
          color: 'white',
          backgroundColor: '#1ea7fd',
        }
      : {
          color: '#333',
          backgroundColor: 'transparent',
          boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset',
        };
    const sizeStyles = {
      small: {
        fontSize: '12px',
        padding: '10px 16px',
      },
      medium: {
        fontSize: '14px',
        padding: '11px 20px',
      },
      large: {
        fontSize: '16px',
        padding: '12px 24px',
      },
    };
    return {
      fontFamily: "'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontWeight: 700,
      border: 0,
      borderRadius: '3em',
      cursor: 'pointer',
      display: 'inline-block',
      lineHeight: 1,
      ...modeStyles,
      ...sizeStyles[size],
      ...(backgroundColor && { backgroundColor }),
    };
  }
);

/**
 * ## Example button component
 * Comes in three sizes: `small`, `medium`, and `large`.
 *
 * Can be primary or secondary.
 *
 * _ This descriptions is written as a comment above the component_
 */
export const Button = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}: ButtonProps) => (
  <StyledButton
    type="button"
    size={size}
    primary={primary}
    backgroundColor={backgroundColor}
    {...props}
  >
    {label}
  </StyledButton>
);
