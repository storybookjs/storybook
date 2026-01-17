import React, { type CSSProperties, type SelectHTMLAttributes } from 'react';

import { lighten, styled } from 'storybook/theming';

import { isTestEnvironment } from '../../../preview-api/modules/preview-web/render/animation-utils';
import { type Alignments, type Sizes, type ValidationStates, sizes } from './styles';

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
const BaseSelect = styled.select<SelectProps>(sizes, ({ theme }) => ({
  appearance: 'none',
  background: `calc(100% - 12px) center no-repeat url("data:image/svg+xml,%3Csvg width='8' height='4' viewBox='0 0 8 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.30303 0.196815C1.13566 0.0294472 0.864304 0.0294472 0.696937 0.196815C0.529569 0.364182 0.529569 0.635539 0.696937 0.802906L3.69694 3.80291C3.8643 3.97027 4.13566 3.97027 4.30303 3.80291L7.30303 0.802906C7.4704 0.635539 7.4704 0.364182 7.30303 0.196815C7.13566 0.0294473 6.8643 0.0294473 6.69694 0.196815L3.99998 2.89377L1.30303 0.196815Z' fill='%2373828C'/%3E%3C/svg%3E%0A")`,
  backgroundSize: 10,
  padding: '6px 30px 6px 10px',
  '@supports (appearance: base-select)': {
    appearance: 'base-select' as CSSProperties['appearance'],
    background: 'var(--sb-input-background)',
    padding: '6px 10px',
  },
  transition: 'box-shadow 200ms ease-out, opacity 200ms ease-out',
  color: 'var(--sb-input-color, inherit)',
  boxShadow: `0 0 0 1px inset var(--sb-input-border)`,
  borderRadius: 'var(--sb-input-borderRadius)',
  fontSize: 'calc(var(--sb-typography-size-s2) - 1px)',
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
      color: 'var(--sb-textMutedColor)',
    },
  },
  '&:has(option:not([hidden]):checked)': {
    color: 'var(--sb-color-defaultText)',
  },
  '&:focus-visible, &:focus-within': {
    outline: 'none',
    boxShadow: `0 0 0 1px inset var(--sb-color-secondary)`,
  },
  '&::picker-icon': {
    display: 'none',
  },
  '&::picker(select)': {
    appearance: 'base-select' as CSSProperties['appearance'],
    border: '1px solid #e4e4e7',
    padding: 4,
    marginTop: 4,
    background: theme.base === 'light' ? lighten(theme.background.app) : 'var(--sb-background-app)',
    filter: `
      drop-shadow(0 5px 5px rgba(0,0,0,0.05))
      drop-shadow(0 0 3px rgba(0,0,0,0.1))
    `,
    borderRadius: 'calc(var(--sb-appBorderRadius) + 2px)',
    fontSize: 'var(--sb-typography-size-s1)',
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
    color: 'var(--sb-color-defaultText)',
    '&::checkmark': {
      display: 'none',
    },
    '&:hover, &:focus-visible': {
      backgroundColor: 'var(--sb-background-hoverable)',
    },
    '&:checked': {
      color: 'var(--sb-color-secondary)',
      fontWeight: 'var(--sb-typography-weight-bold)',
    },
    '&:disabled': {
      backgroundColor: 'transparent',
      cursor: 'default',
      color: 'var(--sb-color-defaultText)',
    },
  },
}));
export const Select = ({ children, ...props }: SelectProps) => {
  return (
    // @ts-expect-error Weird props mismatch
    <BaseSelect {...props}>
      {/* TODO Remove condition when this issue is resolved: https://github.com/facebook/react/issues/33609 */}
      {!isTestEnvironment() && (
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
      )}
      <optgroup>{children}</optgroup>
    </BaseSelect>
  );
};
