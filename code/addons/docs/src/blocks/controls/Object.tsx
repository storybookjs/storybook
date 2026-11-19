import type { FC, FocusEvent, SyntheticEvent } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Form, ToggleButton } from 'storybook/internal/components';

import { announce } from '@react-aria/live-announcer';
import { AddIcon, EditIcon, SubtractIcon } from '@storybook/icons';

import { cloneDeep } from 'es-toolkit/object';
import { styled } from 'storybook/theming/emotion';

import { getControlId, getControlSetterButtonId } from './helpers';
import { JsonTree } from './react-editable-json-tree';
import type { ControlProps, ObjectConfig, ObjectValue } from './types';

const { window: globalWindow } = globalThis;

const Wrapper = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  isolation: 'isolate',
  gap: 8,

  '.rejt-tree': {
    flex: 1,
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
    color: theme.color.secondary,
    lineHeight: '22px',
  },
  '.rejt-not-collapsed-list': {
    listStyle: 'none',
    margin: '0 0 0 1rem',
    padding: 0,
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
  '.rejt-collapsed-value': {
    color: theme.color.defaultText,
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
  alignSelf: 'flex-start',
  order: 2,
  marginRight: -10,
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

const RawInputWrapper = styled.div({
  flex: 1,
  display: 'grid',
  gap: 6,
});

const ErrorMessage = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.base === 'dark' ? theme.color.negative : theme.color.negativeText,
  fontSize: theme.typography.size.s2,
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

const parseJson = (raw: string): { value: unknown } | { error: string } => {
  try {
    return { value: JSON.parse(raw) };
  } catch (e) {
    return { error: (e as Error).message };
  }
};

interface RawJsonEditorProps {
  id: string;
  name: string;
  /** The serialized arg value. The draft is replaced whenever it changes. */
  jsonString: string;
  onChange: ObjectProps['onChange'];
  selectOnMount: boolean;
  readOnly: boolean;
  required?: boolean;
}

const RawJsonEditor: FC<RawJsonEditorProps> = ({
  id,
  name,
  jsonString,
  onChange,
  selectOnMount,
  readOnly,
  required,
}) => {
  const [draft, setDraft] = useState(jsonString);
  const [parseError, setParseError] = useState<string | null>(null);
  const errorId = `${id}-error`;

  // Reset during render rather than in an effect, so that a new arg value never paints next to
  // the draft and error of the previous one.
  const [syncedJsonString, setSyncedJsonString] = useState(jsonString);
  if (syncedJsonString !== jsonString) {
    setSyncedJsonString(jsonString);
    setDraft(jsonString);
    setParseError(null);
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selectOnMount) {
      textareaRef.current?.select();
    }
  }, [selectOnMount]);

  // Typing JSON goes through invalid states on almost every keystroke, so an error is only raised
  // when the draft is committed on blur. An error that is already shown clears as soon as the
  // draft is valid again.
  const onDraftChange = (raw: string) => {
    setDraft(raw);
    if (parseError && (!raw || 'value' in parseJson(raw))) {
      setParseError(null);
    }
  };

  const commit = (raw: string) => {
    if (!raw) {
      setParseError(null);
      return;
    }
    const result = parseJson(raw);
    if ('error' in result) {
      setParseError(result.error);
      // Focus has left the field, so the message it is described by would go unheard.
      announce(`Invalid JSON: ${result.error}`, 'polite');
      return;
    }
    setParseError(null);
    onChange(result.value);
  };

  return (
    <RawInputWrapper>
      <label htmlFor={id} className="sb-sr-only">
        Edit {name} as JSON
      </label>
      <RawInput
        ref={textareaRef}
        id={id}
        minRows={3}
        name={name}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={(event: FocusEvent<HTMLTextAreaElement>) => commit(event.target.value)}
        placeholder="Edit JSON string..."
        autoFocus={selectOnMount}
        valid={parseError ? 'error' : undefined}
        readOnly={readOnly}
        aria-required={required || undefined}
        aria-invalid={parseError ? true : undefined}
        aria-describedby={parseError ? errorId : undefined}
      />
      {parseError && <ErrorMessage id={errorId}>Invalid JSON: {parseError}</ErrorMessage>}
    </RawInputWrapper>
  );
};

export type ObjectProps = ControlProps<ObjectValue> & ObjectConfig;

export const ObjectControl: FC<ObjectProps> = ({
  name,
  storyId,
  controlsId,
  value,
  onChange,
  argType,
  required,
}) => {
  const data = useMemo(() => value && cloneDeep(value), [value]);
  const hasData = data !== null && data !== undefined;
  const [showRaw, setShowRaw] = useState(!hasData);
  const hadDataRef = useRef(hasData);

  const readonly = !!argType?.table?.readonly;
  const isArray = argType?.type?.name === 'array';

  const [forceVisible, setForceVisible] = useState(false);
  const onForceVisible = useCallback(() => {
    onChange(isArray ? [] : {});
    setForceVisible(true);
  }, [isArray, onChange, setForceVisible]);

  useEffect(() => {
    if (!hadDataRef.current && hasData && showRaw && !forceVisible) {
      setShowRaw(false);
    }
    hadDataRef.current = hasData;
  }, [forceVisible, hasData, showRaw]);

  // JSON.stringify returns undefined for values it cannot serialize, such as functions.
  const jsonString = useMemo(() => JSON.stringify(data ?? '', null, 2) ?? '', [data]);

  if (!hasData) {
    return (
      <Button
        ariaLabel={false}
        disabled={readonly}
        id={getControlSetterButtonId(name, storyId, controlsId)}
        onClick={onForceVisible}
      >
        {isArray ? 'Set array' : 'Set object'}
      </Button>
    );
  }

  const rawJSONForm = (
    <RawJsonEditor
      id={getControlId(name, storyId, controlsId)}
      name={name}
      jsonString={jsonString}
      onChange={onChange}
      selectOnMount={forceVisible}
      readOnly={readonly}
      required={required}
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
          ariaLabel={`Edit ${name} as JSON`}
          onClick={(e: SyntheticEvent) => {
            e.preventDefault();
            setShowRaw((isRaw) => !isRaw);
          }}
          variant="ghost"
          padding="small"
          size="small"
        >
          <EditIcon />
        </RawButton>
      )}
      {!showRaw ? (
        <JsonTree
          readOnly={readonly || !isObjectOrArray}
          isCollapsed={isObjectOrArray ? /* default value */ undefined : () => true}
          data={data}
          rootName={name}
          onFullyUpdate={onChange}
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
          inputElement={(_: unknown, __: unknown, ___: unknown, key: string) =>
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
