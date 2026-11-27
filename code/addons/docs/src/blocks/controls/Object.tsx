import type { FC, SyntheticEvent } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Form } from 'storybook/internal/components';

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

const EditorSwitchButton = styled(Button)({
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
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

/**
 * The text being edited in the raw JSON editor, and the error raised when it last failed to parse.
 *
 * @param jsonString The serialized arg value. The draft is replaced whenever it changes.
 */
const useJsonDraft = (jsonString: string, onChange: ObjectProps['onChange']) => {
  const [draft, setDraft] = useState(jsonString);
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasUncommittedEdits, setHasUncommittedEdits] = useState(false);

  const reset = () => {
    setDraft(jsonString);
    setParseError(null);
    setHasUncommittedEdits(false);
  };

  // Reset during render rather than in an effect, so that a new arg value never paints next to
  // the draft and error of the previous one.
  const [syncedJsonString, setSyncedJsonString] = useState(jsonString);
  if (syncedJsonString !== jsonString) {
    setSyncedJsonString(jsonString);
    reset();
  }

  // Typing JSON goes through invalid states on almost every keystroke, so an error is only raised
  // when the draft is committed. An error that is already shown clears as soon as the draft is
  // valid again.
  const edit = (raw: string) => {
    setDraft(raw);
    setHasUncommittedEdits(true);
    if (parseError && (!raw || 'value' in parseJson(raw))) {
      setParseError(null);
    }
  };

  /**
   * Passes the draft on as the new arg value. It can be called from several places for the same
   * edit, such as the editor losing focus and then a button being clicked, and passes the value on
   * once.
   *
   * @returns Whether the draft is safe to drop: it was passed on, or it holds nothing to pass on.
   */
  const commit = (): boolean => {
    if (!hasUncommittedEdits) {
      return true;
    }
    if (!draft) {
      setParseError(null);
      return true;
    }
    const result = parseJson(draft);
    if ('error' in result) {
      setParseError(result.error);
      // The draft is usually committed when focus leaves the editor, so the message the editor is
      // described by would go unheard.
      announce(`Invalid JSON: ${result.error}`, 'polite');
      return false;
    }
    setParseError(null);
    setHasUncommittedEdits(false);
    onChange(result.value);
    return true;
  };

  return { draft, parseError, edit, commit, reset };
};

interface RawJsonEditorProps {
  id: string;
  name: string;
  draft: string;
  parseError: string | null;
  onEdit: (raw: string) => void;
  onCommit: () => void;
  /** Whether the draft was just seeded by "Set object" or "Set array" and is yet to take focus. */
  isAwaitingSeedFocus: boolean;
  onSeedFocused: () => void;
  readOnly: boolean;
  required?: boolean;
}

const RawJsonEditor: FC<RawJsonEditorProps> = ({
  id,
  name,
  draft,
  parseError,
  onEdit,
  onCommit,
  isAwaitingSeedFocus,
  onSeedFocused,
  readOnly,
  required,
}) => {
  const errorId = `${id}-error`;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (isAwaitingSeedFocus) {
      textareaRef.current?.focus();
      // Inside the brackets of the seeded `{}` or `[]`, where the first entry goes.
      textareaRef.current?.setSelectionRange(1, 1);
      onSeedFocused();
    }
  }, [isAwaitingSeedFocus, onSeedFocused]);

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
        onChange={(event) => onEdit(event.target.value)}
        onBlur={onCommit}
        placeholder="Edit JSON string..."
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
  defaultEditor,
}) => {
  const data = useMemo(() => value && cloneDeep(value), [value]);
  const hasData = data !== null && data !== undefined;
  const [showRaw, setShowRaw] = useState(() => defaultEditor === 'json' || !hasData);
  const hadDataRef = useRef(hasData);

  const readonly = !!argType?.table?.readonly;
  const isArray = argType?.type?.name === 'array';

  // Set by the "Set object" / "Set array" button, and cleared once the raw editor that opens on
  // the seeded value has taken focus.
  const [isAwaitingSeedFocus, setIsAwaitingSeedFocus] = useState(false);
  const seedValue = useCallback(() => {
    onChange(isArray ? [] : {});
    setIsAwaitingSeedFocus(true);
  }, [isArray, onChange]);
  const onSeedFocused = useCallback(() => setIsAwaitingSeedFocus(false), []);

  useEffect(() => {
    if (!hadDataRef.current && hasData && showRaw && !isAwaitingSeedFocus) {
      setShowRaw(false);
    }
    hadDataRef.current = hasData;
  }, [isAwaitingSeedFocus, hasData, showRaw]);

  // JSON.stringify returns undefined for values it cannot serialize, such as functions.
  const jsonString = useMemo(() => JSON.stringify(data ?? '', null, 2) ?? '', [data]);
  const jsonDraft = useJsonDraft(jsonString, onChange);

  if (!hasData) {
    return (
      <Button
        ariaLabel={false}
        disabled={readonly}
        id={getControlSetterButtonId(name, storyId, controlsId)}
        onClick={seedValue}
      >
        {isArray ? 'Set array' : 'Set object'}
      </Button>
    );
  }

  const rawJSONForm = (
    <RawJsonEditor
      id={getControlId(name, storyId, controlsId)}
      name={name}
      draft={jsonDraft.draft}
      parseError={jsonDraft.parseError}
      onEdit={jsonDraft.edit}
      onCommit={jsonDraft.commit}
      isAwaitingSeedFocus={isAwaitingSeedFocus}
      onSeedFocused={onSeedFocused}
      readOnly={readonly}
      required={required}
    />
  );

  const isObjectOrArray =
    Array.isArray(value) || (typeof value === 'object' && value?.constructor === Object);

  // Leaving the raw editor drops its draft, so a draft that does not parse keeps the user there.
  const isLockedInRaw = !!jsonDraft.parseError;
  const lockedReason = isLockedInRaw ? 'Fix the invalid JSON to switch editors' : undefined;
  const switchLabel = showRaw
    ? `Edit ${name} with the ${Array.isArray(value) ? 'array' : 'object'} editor`
    : `Edit ${name} as JSON`;

  return (
    <Wrapper>
      {isObjectOrArray && (
        <EditorSwitchButton
          disabled={readonly || isLockedInRaw}
          ariaLabel={switchLabel}
          ariaDescription={lockedReason}
          tooltip={lockedReason}
          onClick={(e: SyntheticEvent) => {
            e.preventDefault();
            // Losing focus commits the draft, but not every click moves focus out of the editor:
            // a screen reader's virtual cursor, voice control and some touch browsers do not.
            if (showRaw && !jsonDraft.commit()) {
              return;
            }
            jsonDraft.reset();
            setShowRaw((isRaw) => !isRaw);
          }}
          variant="ghost"
          padding="small"
          size="small"
        >
          <EditIcon />
        </EditorSwitchButton>
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
