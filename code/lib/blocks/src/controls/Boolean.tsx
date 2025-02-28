import type { FC } from 'react';
import React, { useCallback } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { opacify, transparentize } from 'polished';

import { getControlId, getControlSetterButtonId } from './helpers';
import type { BooleanConfig, BooleanValue, ControlProps } from './types';

const Label = styled.label(({ theme }) => ({
  lineHeight: '18px',
  alignItems: 'center',
  marginBottom: 8,
  display: 'inline-block',
  position: 'relative',
  whiteSpace: 'nowrap',
  background: theme.boolean.background,
  borderRadius: '3em',
  padding: 1,
  '&[aria-disabled="true"]': {
    opacity: 0.5,

    input: {
      cursor: 'not-allowed',
    },
  },

  input: {
    appearance: 'none',
    width: '100%',
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '3em',

    '&:focus': {
      outline: 'none',
      boxShadow: `${theme.color.secondary} 0 0 0 1px inset !important`,
    },
    '@media (forced-colors: active)': {
      '&:focus': {
        outline: '1px solid highlight',
      },
    },
  },

  span: {
    textAlign: 'center',
    fontSize: theme.typography.size.s1,
    fontWeight: theme.typography.weight.bold,
    lineHeight: '1',
    cursor: 'pointer',
    display: 'inline-block',
    padding: '7px 15px',
    transition: 'all 100ms ease-out',
    userSelect: 'none',
    borderRadius: '3em',

    color: transparentize(0.5, theme.color.defaultText),
    background: 'transparent',

    '&:hover': {
      boxShadow: `${opacify(0.3, theme.appBorderColor)} 0 0 0 1px inset`,
    },

    '&:active': {
      boxShadow: `${opacify(0.05, theme.appBorderColor)} 0 0 0 2px inset`,
      color: opacify(1, theme.appBorderColor),
    },

    '&:first-of-type': {
      paddingRight: 8,
    },
    '&:last-of-type': {
      paddingLeft: 8,
    },
  },

  'input:checked ~ span:last-of-type, input:not(:checked) ~ span:first-of-type': {
    background: theme.boolean.selectedBackground,
    boxShadow:
      theme.base === 'light'
        ? `${opacify(0.1, theme.appBorderColor)} 0 0 2px`
        : `${theme.appBorderColor} 0 0 0 1px`,
    color: theme.color.defaultText,
    padding: '7px 15px',

    '@media (forced-colors: active)': {
      textDecoration: 'underline',
    },
  },
}));

const parse = (value: string | null): boolean => value === 'true';

export type BooleanProps = ControlProps<BooleanValue> & BooleanConfig;
/**
 * # Boolean Control
 *
 * Renders a switch toggle with "True" or "False". or if the value is `undefined`, renders a button
 * to set the boolean.
 *
 * ## Example usage
 *
 * ```
 * <BooleanControl name="isTrue" value={value} onChange={handleValueChange} />;
 * ```
 */
export const BooleanControl: FC<BooleanProps> = ({
  name,
  value,
  onChange,
  onBlur,
  onFocus,
  argType,
}) => {
  const onSetFalse = useCallback(() => onChange(false), [onChange]);
  const readonly = !!argType?.table?.readonly;
  if (value === undefined) {
    return (
      <Button
        variant="outline"
        size="medium"
        id={getControlSetterButtonId(name)}
        onClick={onSetFalse}
        disabled={readonly}
      >
        Set boolean
      </Button>
    );
  }
  const controlId = getControlId(name);

  const parsedValue = typeof value === 'string' ? parse(value) : value;

  return (
    <Label aria-disabled={readonly} htmlFor={controlId} aria-label={name}>
      <input
        id={controlId}
        type="checkbox"
        onChange={(e) => onChange(e.target.checked)}
        checked={parsedValue}
        role="switch"
        disabled={readonly}
        {...{ name, onBlur, onFocus }}
      />
      <span aria-hidden="true">False</span>
      <span aria-hidden="true">True</span>
    </Label>
  );
};
