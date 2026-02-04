import type { FC } from 'react';
import React from 'react';

import { logger } from 'storybook/internal/client-logger';

import { styled } from 'storybook/theming';

import { getControlId } from '../helpers';
import type { ControlProps, NormalizedOptionsConfig, OptionsSingleSelection } from '../types';
import { selectedKey } from './helpers';

const Wrapper = styled.fieldset<{ isInline: boolean }>(
  {
    border: 'none',
    marginInline: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'flex-start',
  },
  ({ isInline }) =>
    isInline
      ? {
          flexWrap: 'wrap',
          gap: 15,
          label: {
            display: 'inline-flex',
          },
        }
      : {
          flexDirection: 'column',
          gap: 8,
          label: {
            display: 'flex',
          },
        }
);

const Text = styled.span<{ $readOnly: boolean }>(({ $readOnly }) => ({
  opacity: $readOnly ? 0.5 : 1,
}));

const Label = styled.label<{ $readOnly: boolean }>(({ $readOnly }) => ({
  lineHeight: '20px',
  alignItems: 'center',

  cursor: $readOnly ? 'not-allowed' : 'pointer',

  input: {
    cursor: $readOnly ? 'not-allowed' : 'pointer',
    margin: 0,
    marginRight: 6,
  },
}));

type RadioConfig = NormalizedOptionsConfig & { isInline: boolean };
type RadioProps = ControlProps<OptionsSingleSelection> & RadioConfig;
export const RadioControl: FC<RadioProps> = ({
  name,
  options,
  value,
  onChange,
  isInline,
  argType,
  idPrefix,
}) => {
  if (!options) {
    logger.warn(`Radio with no options: ${name}`);
    return <>-</>;
  }
  const selection = selectedKey(value, options);
  const controlId = getControlId(name, idPrefix);

  const readonly = !!argType?.table?.readonly;

  return (
    <Wrapper isInline={isInline}>
      <legend className="sb-sr-only">{name}</legend>
      {Object.keys(options).map((key, index) => {
        const id = `${controlId}-${index}`;
        return (
          <Label key={id} htmlFor={id} $readOnly={readonly}>
            <input
              type="radio"
              id={id}
              name={controlId}
              disabled={readonly}
              value={key}
              onChange={(e) => onChange(options[e.currentTarget.value])}
              checked={key === selection}
            />
            <Text $readOnly={readonly}>{key}</Text>
          </Label>
        );
      })}
    </Wrapper>
  );
};
