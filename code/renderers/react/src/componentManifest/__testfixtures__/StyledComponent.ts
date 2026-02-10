import styled from 'styled-components';

interface StyledButtonProps {
  /** The button variant */
  variant?: 'primary' | 'secondary';
  /** Whether the button is full width */
  fullWidth?: boolean;
}

export const StyledButton = styled.button<StyledButtonProps>`
  background: ${(props) => (props.variant === 'primary' ? 'blue' : 'gray')};
  width: ${(props) => (props.fullWidth ? '100%' : 'auto')};
`;

// Alternative: styled component created with attrs or as a function call
export const StyledCard = styled('div')<{ title: string; bordered?: boolean }>`
  border: ${(props) => (props.bordered ? '1px solid' : 'none')};
`;

// Alternative: using .attrs
export const StyledInput = styled.input.attrs({ type: 'text' })<{
  size?: 'small' | 'large';
}>`
  font-size: ${(props) => (props.size === 'large' ? '18px' : '14px')};
`;

export const PlainExport = (props: { label: string }) => null;
