import type { ComponentProps, FC, FocusEvent, SyntheticEvent } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Form, ToggleButton } from 'storybook/internal/components';

import { AddIcon, SubtractIcon } from '@storybook/icons';

import { cloneDeep } from 'es-toolkit/object';
import { type Theme, styled, useTheme } from 'storybook/theming';

import { getControlId, getControlSetterButtonId } from './helpers';
import { JsonTree } from './react-editable-json-tree';
import type { ControlProps, ObjectConfig, ObjectValue } from './types';

const { window: globalWindow } = globalThis;

type JsonTreeProps = ComponentProps<typeof JsonTree>;

const Wrapper = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  isolation: 'isolate',

  '.rejt-tree': {
    marginLeft: '1rem',
    fontSize: '13px',
    listStyleType: 'none',
  },
  '.rejt-value-node:hover': {
    '& > button': {
      opacity: 1,
    },
  },
  '.rejt-add-form': {
    marginLeft: 10,
  },
  '.rejt-add-value-node': {
    display: 'inline-flex',
    alignItems: 'center',
  },
  '.rejt-name': {
    lineHeight: '22px',
  },
  '.rejt-not-collapsed-delimiter': {
    lineHeight: '22px',
  },
  '.rejt-value': {
    display: 'inline-block',
    border: '1px solid transparent',
    borderRadius: 4,
    margin: '1px 0',
    padding: '0 4px',
    cursor: 'text',
    color: theme.color.defaultText,
  },
  '.rejt-value-node:hover > .rejt-value': {
    background: theme.base === 'light' ? theme.color.lighter : 'hsl(0 0 100 / 0.02)',
    borderColor: theme.appBorderColor,
  },
}));

const ButtonInline = styled.button<{ primary?: boolean }>(({ theme, primary }) => ({
  border: 0,
  height: 20,
  margin: 1,
  borderRadius: 4,
  background: primary ? theme.color.secondary : 'transparent',
  color: primary ? theme.color.lightest : theme.color.dark,
  fontWeight: primary ? 'bold' : 'normal',
  cursor: 'pointer',
}));

const ActionButton = styled.button(({ theme }) => ({
  background: 'none',
  border: 0,
  display: 'inline-flex',
  verticalAlign: 'middle',
  padding: 3,
  marginLeft: 5,
  color: theme.textMutedColor,
  opacity: 0,
  transition: 'opacity 0.2s',
  cursor: 'pointer',
  position: 'relative',
  svg: {
    width: 9,
    height: 9,
  },
  ':disabled': {
    cursor: 'not-allowed',
  },
  ':hover, :focus-visible': {
    opacity: 1,
  },
  '&:hover:not(:disabled), &:focus-visible:not(:disabled)': {
    '&.rejt-plus-menu': {
      color: theme.color.ancillary,
    },
    '&.rejt-minus-menu': {
      color: theme.color.negative,
    },
  },
}));

const Input = styled.input(({ theme, placeholder }) => ({
  outline: 0,
  margin: placeholder ? 1 : '1px 0',
  padding: '3px 4px',
  color: theme.color.defaultText,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  lineHeight: '14px',
  width: placeholder === 'Key' ? 80 : 120,
  '&:focus': {
    border: `1px solid ${theme.color.secondary}`,
  },
}));

const RawButton = styled(ToggleButton)({
  position: 'absolute',
  zIndex: 2,
  top: 2,
  right: 2,
});

const RawInput = styled(Form.Textarea)(({ theme }) => ({
  flex: 1,
  padding: '7px 6px',
  fontFamily: theme.typography.fonts.mono,
  fontSize: '12px',
  lineHeight: '18px',
  '&::placeholder': {
    fontFamily: theme.typography.fonts.base,
    fontSize: '13px',
  },
  '&:placeholder-shown': {
    padding: '7px 10px',
  },
}));

const ENTER_EVENT = {
  bubbles: true,
  cancelable: true,
  key: 'Enter',
  code: 'Enter',
  keyCode: 13,
};
const dispatchEnterKey = (event: SyntheticEvent<HTMLInputElement>) => {
  event.currentTarget.dispatchEvent(new globalWindow.KeyboardEvent('keydown', ENTER_EVENT));
};
const selectValue = (event: SyntheticEvent<HTMLInputElement>) => {
  event.currentTarget.select();
};

export type ObjectProps = ControlProps<ObjectValue> & ObjectConfig;

const getCustomStyleFunction: (theme: Theme) => JsonTreeProps['getStyle'] = (theme) => () => ({
  name: {
    color: theme.color.secondary,
  },
  collapsed: {
    color: theme.color.dark,
  },
  ul: {
    listStyle: 'none',
    margin: '0 0 0 1rem',
    padding: 0,
  },
  li: {
    outline: 0,
  },
});

export const ObjectControl: FC<ObjectProps> = ({ name, value, onChange, argType }) => {
  const theme = useTheme();
  const data = useMemo(() => value && cloneDeep(value), [value]);
  const hasData = data !== null && data !== undefined;
  const [showRaw, setShowRaw] = useState(!hasData);

  const [parseError, setParseError] = useState<Error | null>(null);
  const readonly = !!argType?.table?.readonly;
  const updateRaw: (raw: string) => void = useCallback(
    (raw) => {
      try {
        if (raw) {
          onChange(JSON.parse(raw));
        }
        setParseError(null);
      } catch (e) {
        setParseError(e as Error);
      }
    },
    [onChange]
  );

  const [forceVisible, setForceVisible] = useState(false);
  const onForceVisible = useCallback(() => {
    onChange({});
    setForceVisible(true);
  }, [setForceVisible]);

  const htmlElRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (forceVisible && htmlElRef.current) {
      htmlElRef.current.select();
    }
  }, [forceVisible]);

  // Use string value as key to force re-render on Arg value reset.
  const jsonString = useMemo(() => {
    return JSON.stringify(data ?? '', null, 2);
  }, [data]);

  if (!hasData) {
    return (
      <Button
        ariaLabel={false}
        disabled={readonly}
        id={getControlSetterButtonId(name)}
        onClick={onForceVisible}
      >
        Set object
      </Button>
    );
  }

  const rawJSONForm = (
    <RawInput
      ref={htmlElRef}
      id={getControlId(name)}
      minRows={3}
      name={name}
      key={jsonString}
      defaultValue={jsonString}
      onBlur={(event: FocusEvent<HTMLTextAreaElement>) => updateRaw(event.target.value)}
      placeholder="Edit JSON string..."
      autoFocus={forceVisible}
      valid={parseError ? 'error' : undefined}
      readOnly={readonly}
    />
  );

  const isObjectOrArray =
    Array.isArray(value) || (typeof value === 'object' && value?.constructor === Object);

  return (
    <Wrapper>
      {isObjectOrArray && (
        <RawButton
          disabled={readonly}
          pressed={showRaw}
          ariaLabel={`Edit the ${name} properties in JSON format`}
          onClick={(e: SyntheticEvent) => {
            e.preventDefault();
            setShowRaw((isRaw) => !isRaw);
          }}
        >
          Edit JSON
        </RawButton>
      )}
      {!showRaw ? (
        <JsonTree
          readOnly={readonly || !isObjectOrArray}
          isCollapsed={isObjectOrArray ? /* default value */ undefined : () => true}
          data={data}
          rootName={name}
          onFullyUpdate={onChange}
          getStyle={getCustomStyleFunction(theme)}
          cancelButtonElement={<ButtonInline type="button">Cancel</ButtonInline>}
          addButtonElement={
            <ButtonInline type="submit" primary>
              Save
            </ButtonInline>
          }
          plusMenuElement={
            <ActionButton type="button">
              <AddIcon />
            </ActionButton>
          }
          minusMenuElement={
            <ActionButton type="button">
              <SubtractIcon />
            </ActionButton>
          }
          inputElement={(_: any, __: any, ___: any, key: string) =>
            key ? <Input onFocus={selectValue} onBlur={dispatchEnterKey} /> : <Input />
          }
          fallback={rawJSONForm}
        />
      ) : (
        rawJSONForm
      )}
    </Wrapper>
  );
};
