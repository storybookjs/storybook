import type { ChangeEvent, FC } from 'react';
import React, { useCallback, useState } from 'react';

import { Button, Form } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { getControlId, getControlSetterButtonId } from './helpers';
import type { ControlProps, TextConfig, TextValue } from './types';

export type TextProps = ControlProps<TextValue | undefined> & TextConfig;

const Wrapper = styled.label({
  display: 'flex',
});

const MaxLength = styled.div<{ isMaxed: boolean }>(({ isMaxed }) => ({
  marginLeft: '0.75rem',
  paddingTop: '0.35rem',
  color: isMaxed ? 'red' : undefined,
}));

export const TextControl: FC<TextProps> = ({
  name,
  value,
  onChange,
  onFocus,
  onBlur,
  maxLength,
  argType,
}) => {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const readonly = !!argType?.table?.readonly;

  const [forceVisible, setForceVisible] = useState(false);

  const onForceVisible = useCallback(() => {
    onChange('');
    setForceVisible(true);
  }, [setForceVisible]);

  if (value === undefined) {
    return (
      <Button
        variant="outline"
        size="medium"
        disabled={readonly}
        id={getControlSetterButtonId(name)}
        onClick={onForceVisible}
      >
        Set string
      </Button>
    );
  }

  const isValid = typeof value === 'string';

  return (
    <Wrapper>
      <Form.Textarea
        id={getControlId(name)}
        maxLength={maxLength}
        onChange={handleChange}
        disabled={readonly}
        size="flex"
        placeholder="Edit string..."
        autoFocus={forceVisible}
        valid={isValid ? null : 'error'}
        {...{ name, value: isValid ? value : '', onFocus, onBlur }}
      />
      {maxLength && (
        <MaxLength isMaxed={value?.length === maxLength}>
          {value?.length ?? 0} / {maxLength}
        </MaxLength>
      )}
    </Wrapper>
  );
};
