import type { ChangeEvent, FC } from 'react';
import React, { useEffect, useState } from 'react';

import { logger } from 'storybook/internal/client-logger';

import { styled } from 'storybook/theming';

import { getControlId } from '../helpers';
import type { ControlProps, NormalizedOptionsConfig, OptionsMultiSelection } from '../types';
import { selectedKeys, selectedValues } from './helpers';

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

const Text = styled.span({
  '[aria-readonly=true] &': {
    opacity: 0.5,
  },
});

const Label = styled.label({
  lineHeight: '20px',
  alignItems: 'center',
  '[aria-readonly=true] &': {
    cursor: 'not-allowed',
  },

  input: {
    '[aria-readonly=true] &': {
      cursor: 'not-allowed',
    },
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

  const initial = selectedKeys(value || [], options);
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
    setSelected(selectedKeys(value || [], options));
  }, [value]);

  const controlId = getControlId(name);

  return (
    <Wrapper isInline={isInline}>
      <legend className="sb-sr-only">{name}</legend>
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
