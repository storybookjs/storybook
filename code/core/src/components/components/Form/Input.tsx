import type { CSSProperties, HTMLProps, SelectHTMLAttributes } from 'react';
import React, { forwardRef } from 'react';

import TextareaAutoResize from 'react-textarea-autosize';
import type { CSSObject, StorybookTheme } from 'storybook/theming';
import { lighten, styled } from 'storybook/theming';

/**
 * These types are copied from `react-textarea-autosize`. I copied them because of
 * https://github.com/storybookjs/storybook/issues/18734 Maybe there's some bug in `tsup` or
 * `react-textarea-autosize`?
 */
type TextareaPropsRaw = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type Style = Omit<NonNullable<TextareaPropsRaw['style']>, 'maxHeight' | 'minHeight'> & {
  height?: number;
};
type TextareaHeightChangeMeta = {
  rowHeight: number;
};
export interface TextareaAutosizeProps extends Omit<TextareaPropsRaw, 'style'> {
  maxRows?: number;
  minRows?: number;
  onHeightChange?: (height: number, meta: TextareaHeightChangeMeta) => void;
  cacheMeasurements?: boolean;
  style?: Style;
}

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

const styles = (({ theme }: { theme: StorybookTheme }) => ({
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

export type Sizes = '100%' | 'flex' | 'auto';
export type Alignments = 'end' | 'center' | 'start';
export type ValidationStates = 'valid' | 'error' | 'warn';

const sizes = (({ size }: { size?: Sizes }) => {
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
const alignment = (({
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
const validation = (({ valid, theme }: { valid: ValidationStates; theme: StorybookTheme }) => {
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

type InputProps = Omit<
  HTMLProps<HTMLInputElement>,
  keyof {
    size?: Sizes;
    align?: Alignments;
    valid?: ValidationStates;
    height?: number;
  }
> & {
  size?: Sizes;
  align?: Alignments;
  valid?: ValidationStates;
  height?: number;
};
export const Input = Object.assign(
  styled(
    forwardRef<any, InputProps>(function Input({ size, valid, align, ...props }, ref) {
      return <input {...props} ref={ref} />;
    })
  )<InputProps>(styles, sizes, alignment, validation, {
    minHeight: 32,
  }),
  {
    displayName: 'Input',
  }
);

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  keyof {
    size?: Sizes;
    align?: Alignments;
    valid?: ValidationStates;
    height?: number;
  }
> & {
  size?: Sizes;
  align?: Alignments;
  valid?: ValidationStates;
  height?: number;
};
const BaseSelect = styled.select(sizes, ({ theme }) => ({
  appearance: 'none',
  background: `calc(100% - 12px) center no-repeat url("data:image/svg+xml,%3Csvg width='8' height='4' viewBox='0 0 8 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.30303 0.196815C1.13566 0.0294472 0.864304 0.0294472 0.696937 0.196815C0.529569 0.364182 0.529569 0.635539 0.696937 0.802906L3.69694 3.80291C3.8643 3.97027 4.13566 3.97027 4.30303 3.80291L7.30303 0.802906C7.4704 0.635539 7.4704 0.364182 7.30303 0.196815C7.13566 0.0294473 6.8643 0.0294473 6.69694 0.196815L3.99998 2.89377L1.30303 0.196815Z' fill='%2373828C'/%3E%3C/svg%3E%0A")`,
  backgroundSize: 10,
  padding: '6px 18px 6px 10px',
  '@supports (appearance: base-select)': {
    appearance: 'base-select' as CSSProperties['appearance'],
    background: theme.input.background,
    padding: '6px 10px',
  },
  transition: 'box-shadow 200ms ease-out, opacity 200ms ease-out',
  color: theme.input.color || 'inherit',
  boxShadow: `${theme.input.border} 0 0 0 1px inset`,
  borderRadius: theme.input.borderRadius,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '20px',
  boxSizing: 'border-box',
  border: 'none',
  cursor: 'pointer',
  '& > button': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    '& > svg': {
      width: 14,
      height: 14,
      color: theme.color.mediumdark,
    },
  },
  '&:has(option:not([hidden]):checked)': {
    color: theme.color.defaultText,
  },
  '&:focus-visible, &:focus-within': {
    outline: 'none',
    boxShadow: `${theme.color.secondary} 0 0 0 1px inset`,
  },
  '&::picker-icon': {
    display: 'none',
  },
  '&::picker(select)': {
    appearance: 'base-select' as CSSProperties['appearance'],
    border: '1px solid #e4e4e7',
    padding: 4,
    marginTop: 4,
    background: theme.base === 'light' ? lighten(theme.background.app) : theme.background.app,
    filter: `
      drop-shadow(0 5px 5px rgba(0,0,0,0.05))
      drop-shadow(0 0 3px rgba(0,0,0,0.1))
    `,
    borderRadius: theme.appBorderRadius + 2,
    fontSize: theme.typography.size.s1,
    cursor: 'default',
    transition: 'opacity 100ms ease-in-out, transform 100ms ease-in-out',
    transformOrigin: 'top',
    transform: 'translateY(0)',
    opacity: 1,
    '@starting-style': {
      transform: 'translateY(-0.25rem) scale(0.95)',
      opacity: 0,
    },
  },
  '& optgroup label': {
    display: 'block',
    padding: '3px 6px',
  },
  '& option': {
    lineHeight: '18px',
    padding: '7px 10px',
    borderRadius: 4,
    outline: 'none',
    cursor: 'pointer',
    color: theme.color.defaultText,
    '&::checkmark': {
      display: 'none',
    },
    '&:hover, &:focus-visible': {
      backgroundColor: theme.background.hoverable,
    },
    '&:checked': {
      color: theme.color.secondary,
      fontWeight: theme.typography.weight.bold,
    },
  },
}));
export const Select = ({ children, ...props }: SelectProps) => {
  return (
    <BaseSelect {...props}>
      <button>
        {/* @ts-expect-error Not yet supported */}
        <selectedcontent></selectedcontent>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6"></path>
        </svg>
      </button>
      <optgroup>{children}</optgroup>
    </BaseSelect>
  );
};

type TextareaProps = Omit<
  TextareaAutosizeProps,
  keyof {
    size?: Sizes;
    align?: Alignments;
    valid?: ValidationStates;
    height?: number;
  }
> & {
  size?: Sizes;
  align?: Alignments;
  valid?: ValidationStates;
  height?: number;
} & React.RefAttributes<HTMLTextAreaElement>;
export const Textarea = Object.assign(
  styled(
    forwardRef<any, TextareaProps>(function Textarea({ size, valid, align, ...props }, ref) {
      return <TextareaAutoResize {...props} ref={ref} />;
    })
  )<TextareaProps>(styles, sizes, alignment, validation, ({ height = 400 }) => ({
    overflow: 'visible',
    maxHeight: height,
  })),
  {
    displayName: 'Textarea',
  }
);
