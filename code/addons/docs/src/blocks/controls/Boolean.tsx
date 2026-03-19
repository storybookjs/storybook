import type { FC } from 'react';
import React, { useCallback } from 'react';

import { Button } from 'storybook/internal/components';

import { opacify, transparentize } from 'polished';
import type { CSSObject, StorybookTheme } from 'storybook/theming';
import { styled } from 'storybook/theming';

import { getControlId, getControlSetterButtonId } from './helpers';
import type { BooleanConfig, BooleanValue, ControlProps } from './types';

export const getBooleanControlStyles = (theme: StorybookTheme): CSSObject => ({
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
  '@media (forced-colors: active)': {
    background: 'ButtonFace',
    outline: '1px solid ButtonText',
  },
  '&:focus-within': {
    outline: 'none',
    boxShadow: `${theme.color.secondary} 0 0 0 1px inset !important`,

    '@media (forced-colors: active)': {
      outline: '1px solid Highlight',
      outlineOffset: 1,
    },
  },

  input: {
    appearance: 'none',
    width: 1,
    height: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    borderRadius: '3em',
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

    '@media (forced-colors: active)': {
      color: 'ButtonText',
      boxShadow: 'none',
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
      forcedColorAdjust: 'none',
      background: 'Highlight',
      color: 'HighlightText',
      boxShadow: 'none',
      outline: '1px solid ButtonText',
    },
  },
});

const Label = styled.label(({ theme }) => getBooleanControlStyles(theme));

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
        ariaLabel={false}
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
