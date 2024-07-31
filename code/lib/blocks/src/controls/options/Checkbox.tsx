import type { FC, ChangeEvent } from 'react';
import React, { useState, useEffect } from 'react';
import { styled } from 'storybook/internal/theming';
import { logger } from 'storybook/internal/client-logger';

import type { ControlProps, OptionsMultiSelection, NormalizedOptionsConfig } from '../types';

import { selectedKeys, selectedValues } from './helpers';
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

type CheckboxConfig = NormalizedOptionsConfig & { isInline: boolean };
type CheckboxProps = ControlProps<OptionsMultiSelection> & CheckboxConfig;
export const CheckboxControl: FC<CheckboxProps> = ({
  name,
  options,
  value,
  onChange,
  isInline,
  argType,
}) => {
  if (!options) {
    logger.warn(`Checkbox with no options: ${name}`);
    return <>-</>;
  }

  const initial = selectedKeys(value, options);
  const [selected, setSelected] = useState(initial);

  const readonly = !!argType?.table?.readonly;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const option = (e.target as HTMLInputElement).value;
    const updated = [...selected];
    if (updated.includes(option)) {
      updated.splice(updated.indexOf(option), 1);
    } else {
      updated.push(option);
    }
    onChange(selectedValues(updated, options));
    setSelected(updated);
  };

  useEffect(() => {
    setSelected(selectedKeys(value, options));
  }, [value]);

  const controlId = getControlId(name);

  return (
    <Wrapper aria-readonly={readonly} isInline={isInline}>
      {Object.keys(options).map((key, index) => {
        const id = `${controlId}-${index}`;
        return (
          <Label key={id} htmlFor={id}>
            <input
              type="checkbox"
              disabled={readonly}
              id={id}
              name={id}
              value={key}
              onChange={handleChange}
              checked={selected?.includes(key)}
            />
            <Text>{key}</Text>
          </Label>
        );
      })}
    </Wrapper>
  );
};
