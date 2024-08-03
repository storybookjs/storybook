import type { FC, ChangeEvent } from 'react';
import React, { useMemo } from 'react';

import { styled } from 'storybook/internal/theming';
import { lighten, darken, rgba } from 'polished';
import { getControlId } from './helpers';

import type { ControlProps, NumberValue, RangeConfig } from './types';

import { parse } from './Number';

type RangeProps = ControlProps<NumberValue | null> & RangeConfig;

const RangeInput = styled.input<{ min: number; max: number; value: number }>(
  ({ theme, min, max, value, disabled }) => ({
    // Resytled using http://danielstern.ca/range.css/#/
    '&': {
      width: '100%',
      backgroundColor: 'transparent',
      appearance: 'none',
    },

    '&::-webkit-slider-runnable-track': {
      background:
        theme.base === 'light'
          ? `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} 100%)`
          : `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} 100%)`,
      boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
      borderRadius: 6,
      width: '100%',
      height: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
    },

    '&::-webkit-slider-thumb': {
      marginTop: '-6px',
      width: 16,
      height: 16,

      border: `1px solid ${rgba(theme.appBorderColor, 0.2)}`,
      borderRadius: '50px',
      boxShadow: `0 1px 3px 0px ${rgba(theme.appBorderColor, 0.2)}`,
      cursor: disabled ? 'not-allowed' : 'grab',
      appearance: 'none',
      background: `${theme.input.background}`,
      transition: 'all 150ms ease-out',

      '&:hover': {
        background: `${darken(0.05, theme.input.background)}`,
        transform: 'scale3d(1.1, 1.1, 1.1) translateY(-1px)',
        transition: 'all 50ms ease-out',
      },

      '&:active': {
        background: `${theme.input.background}`,
        transform: 'scale3d(1, 1, 1) translateY(0px)',
        cursor: disabled ? 'not-allowed' : 'grab',
      },
    },

    '&:focus': {
      outline: 'none',

      '&::-webkit-slider-runnable-track': {
        borderColor: rgba(theme.color.secondary, 0.4),
      },

      '&::-webkit-slider-thumb': {
        borderColor: theme.color.secondary,
        boxShadow: `0 0px 5px 0px ${theme.color.secondary}`,
      },
    },

    '&::-moz-range-track': {
      background:
        theme.base === 'light'
          ? `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} 100%)`
          : `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} 100%)`,
      boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
      borderRadius: 6,
      width: '100%',
      height: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      outline: 'none',
    },

    '&::-moz-range-thumb': {
      width: 16,
      height: 16,
      border: `1px solid ${rgba(theme.appBorderColor, 0.2)}`,
      borderRadius: '50px',
      boxShadow: `0 1px 3px 0px ${rgba(theme.appBorderColor, 0.2)}`,
      cursor: disabled ? 'not-allowed' : 'grap',
      background: `${theme.input.background}`,
      transition: 'all 150ms ease-out',

      '&:hover': {
        background: `${darken(0.05, theme.input.background)}`,
        transform: 'scale3d(1.1, 1.1, 1.1) translateY(-1px)',
        transition: 'all 50ms ease-out',
      },

      '&:active': {
        background: `${theme.input.background}`,
        transform: 'scale3d(1, 1, 1) translateY(0px)',
        cursor: 'grabbing',
      },
    },
    '&::-ms-track': {
      background:
        theme.base === 'light'
          ? `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${darken(0.02, theme.input.background)} 100%)`
          : `linear-gradient(to right, 
            ${theme.color.green} 0%, ${theme.color.green} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} ${((value - min) / (max - min)) * 100}%, 
            ${lighten(0.02, theme.input.background)} 100%)`,
      boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
      color: 'transparent',
      width: '100%',
      height: '6px',
      cursor: 'pointer',
    },
    '&::-ms-fill-lower': {
      borderRadius: 6,
    },
    '&::-ms-fill-upper': {
      borderRadius: 6,
    },
    '&::-ms-thumb': {
      width: 16,
      height: 16,
      background: `${theme.input.background}`,
      border: `1px solid ${rgba(theme.appBorderColor, 0.2)}`,
      borderRadius: 50,
      cursor: 'grab',
      marginTop: 0,
    },
    '@supports (-ms-ime-align:auto)': { 'input[type=range]': { margin: '0' } },
  })
);

const RangeLabel = styled.span({
  paddingLeft: 5,
  paddingRight: 5,
  fontSize: 12,
  whiteSpace: 'nowrap',
  fontFeatureSettings: 'tnum',
  fontVariantNumeric: 'tabular-nums',
  '[aria-readonly=true] &': {
    opacity: 0.5,
  },
});

const RangeCurrentAndMaxLabel = styled(RangeLabel)<{
  numberOFDecimalsPlaces: number;
  max: number;
}>(({ numberOFDecimalsPlaces, max }) => ({
  // Fixed width of "current / max" label to avoid slider width changes
  // 3 = size of separator " / "
  width: `${numberOFDecimalsPlaces + max.toString().length * 2 + 3}ch`,
  textAlign: 'right',
  flexShrink: 0,
}));

const RangeWrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
});

function getNumberOfDecimalPlaces(number: number) {
  const match = number.toString().match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  return !match
    ? 0
    : Math.max(
        0,
        // Number of digits right of decimal point.
        (match[1] ? match[1].length : 0) -
          // Adjust for scientific notation.
          (match[2] ? +match[2] : 0)
      );
}

export const RangeControl: FC<RangeProps> = ({
  name,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  onBlur,
  onFocus,
  argType,
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(parse(event.target.value));
  };

  const hasValue = value !== undefined;
  const numberOFDecimalsPlaces = useMemo(() => getNumberOfDecimalPlaces(step), [step]);

  const readonly = !!argType?.table?.readonly;

  return (
    <RangeWrapper aria-readonly={readonly}>
      <RangeLabel>{min}</RangeLabel>
      <RangeInput
        id={getControlId(name)}
        type="range"
        disabled={readonly}
        onChange={handleChange}
        {...{ name, value, min, max, step, onFocus, onBlur }}
      />
      <RangeCurrentAndMaxLabel numberOFDecimalsPlaces={numberOFDecimalsPlaces} max={max}>
        {hasValue ? value.toFixed(numberOFDecimalsPlaces) : '--'} / {max}
      </RangeCurrentAndMaxLabel>
    </RangeWrapper>
  );
};
