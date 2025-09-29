import type { CSSObject, StorybookTheme } from 'storybook/theming';

export type Sizes = '100%' | 'flex' | 'auto';
export type Alignments = 'end' | 'center' | 'start';
export type ValidationStates = 'valid' | 'error' | 'warn';

export const sizes = (({ size }: { size?: Sizes }) => {
  switch (size) {
    case '100%': {
      return { width: '100%' };
    }
    case 'flex': {
      return { flex: 1 };
    }
    case 'auto':
    default: {
      return { display: 'inline' };
    }
  }
}) as any;

export const alignment = (({
  align,
}: {
  size?: Sizes;
  align?: Alignments;
  valid?: ValidationStates;
  height?: number;
}) => {
  switch (align) {
    case 'end': {
      return { textAlign: 'right' };
    }
    case 'center': {
      return { textAlign: 'center' };
    }
    case 'start':
    default: {
      return { textAlign: 'left' };
    }
  }
}) as any;

export const validation = (({
  valid,
  theme,
}: {
  valid: ValidationStates;
  theme: StorybookTheme;
}) => {
  switch (valid) {
    case 'valid': {
      return { boxShadow: `${theme.color.positive} 0 0 0 1px inset !important` };
    }
    case 'error': {
      return { boxShadow: `${theme.color.negative} 0 0 0 1px inset !important` };
    }
    case 'warn': {
      return {
        boxShadow: `${theme.color.warning} 0 0 0 1px inset`,
      };
    }
    case undefined:
    case null:
    default: {
      return {};
    }
  }
}) as any;

const styleResets: CSSObject = {
  // resets
  appearance: 'none',
  border: '0 none',
  boxSizing: 'inherit',
  display: ' block',
  margin: ' 0',
  background: 'transparent',
  padding: 0,
  fontSize: 'inherit',
  position: 'relative',
};

export const styles = (({ theme }: { theme: StorybookTheme }) => ({
  ...(styleResets as any),

  transition: 'box-shadow 200ms ease-out, opacity 200ms ease-out',
  color: theme.input.color || 'inherit',
  background: theme.input.background,
  boxShadow: `${theme.input.border} 0 0 0 1px inset`,
  borderRadius: theme.input.borderRadius,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '20px',
  padding: '6px 10px', // 32
  boxSizing: 'border-box',
  height: 32,

  '&[type="file"]': {
    height: 'auto',
  },

  '&:focus': {
    boxShadow: `${theme.color.secondary} 0 0 0 1px inset`,
    outline: 'none',
    '@media (forced-colors: active)': {
      outline: '1px solid highlight',
    },
  },

  '&[disabled]': {
    cursor: 'not-allowed',
    opacity: 0.5,
  },

  '&:-webkit-autofill': { WebkitBoxShadow: `0 0 0 3em ${theme.color.lightest} inset` },

  '&::placeholder': {
    color: theme.textMutedColor,
    opacity: 1,
  },
})) as any;
