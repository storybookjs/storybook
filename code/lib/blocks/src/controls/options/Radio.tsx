import type { FC } from 'react';
import React from 'react';
import { styled } from 'storybook/internal/theming';
import { logger } from 'storybook/internal/client-logger';

import type { ControlProps, OptionsSingleSelection, NormalizedOptionsConfig } from '../types';

import { selectedKey } from './helpers';
import { getControlId } from '../helpers';

const Wrapper = styled.div<{ isInline: boolean }>(
  ({ isInline }) =>
    isInline
      ? {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',

          label: {
            display: 'inline-flex',
            marginRight: 15,
          },
        }
      : {
          label: {
            display: 'flex',
          },
        },
  (props) => {
    if (props['aria-readonly'] === 'true') {
      return {
        input: {
          cursor: 'not-allowed',
        },
      };
    }
  }
);

const Text = styled.span({
  '[aria-readonly=true] &': {
    opacity: 0.5,
  },
});

const Label = styled.label({
  lineHeight: '20px',
  alignItems: 'center',
  marginBottom: 8,

  '&:last-child': {
    marginBottom: 0,
  },

  input: {
    margin: 0,
    marginRight: 6,
  },
});

type RadioConfig = NormalizedOptionsConfig & { isInline: boolean };
type RadioProps = ControlProps<OptionsSingleSelection> & RadioConfig;
export const RadioControl: FC<RadioProps> = ({
  name,
  options,
  value,
  onChange,
  isInline,
  argType,
}) => {
  if (!options) {
    logger.warn(`Radio with no options: ${name}`);
    return <>-</>;
  }
  const selection = selectedKey(value, options);
  const controlId = getControlId(name);

  const readonly = !!argType?.table?.readonly;

  return (
    <Wrapper aria-readonly={readonly} isInline={isInline}>
      {Object.keys(options).map((key, index) => {
        const id = `${controlId}-${index}`;
        return (
          <Label key={id} htmlFor={id}>
            <input
              type="radio"
              id={id}
              name={controlId}
              disabled={readonly}
              value={key}
              onChange={(e) => onChange(options[e.currentTarget.value])}
              checked={key === selection}
            />
            <Text>{key}</Text>
          </Label>
        );
      })}
    </Wrapper>
  );
};
