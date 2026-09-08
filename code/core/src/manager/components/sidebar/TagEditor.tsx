import React, { useCallback, useState } from 'react';

import { Button } from 'storybook/internal/components';
import type {
  SaveStoryRequestPayload,
  SaveStoryResponsePayload,
} from 'storybook/internal/core-events';
import { SAVE_STORY_REQUEST, SAVE_STORY_RESPONSE } from 'storybook/internal/core-events';
import type { API_HashEntry } from 'storybook/internal/types';

import { addons, experimental_requestResponse } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: 260,
  padding: 12,
});

const Title = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
}));

const InputWrapper = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: 32,
  padding: '2px 8px',
  boxSizing: 'border-box',
  boxShadow: `${theme.button.border} 0 0 0 1px inset`,
  borderRadius: theme.appBorderRadius + 2,

  '&:has(input:focus), &:has(input:active)': {
    background: theme.background.app,
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

const Input = styled.input(({ theme }) => ({
  appearance: 'none',
  width: '100%',
  height: 28,
  padding: 0,
  border: 0,
  background: 'transparent',
  fontSize: `${theme.typography.size.s1 + 1}px`,
  fontFamily: 'inherit',
  color: theme.color.defaultText,
  outline: 0,

  '&::placeholder': {
    color: theme.textMutedColor,
    opacity: 1,
  },
}));

const Actions = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
});

const ErrorMessage = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.color.negative,
}));

interface TagEditorProps {
  context: API_HashEntry;
  onCancel: () => void;
  onSaved: () => void;
}

export const TagEditor = ({ context, onCancel, onSaved }: TagEditorProps) => {
  const [tag, setTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channel = addons.getChannel();

  const handleAddTag = useCallback(async () => {
    if (context.type !== 'story' || !('importPath' in context) || !context.importPath) {
      return;
    }

    const normalizedTag = tag.trim();

    if (!normalizedTag || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await experimental_requestResponse<SaveStoryRequestPayload, SaveStoryResponsePayload>(
        channel,
        SAVE_STORY_REQUEST,
        SAVE_STORY_RESPONSE,
        {
          args: undefined,
          csfId: context.id,
          importPath: context.importPath,
          tags: [normalizedTag],
        }
      );

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tag could not be added');
    } finally {
      setIsSaving(false);
    }
  }, [channel, context, isSaving, onSaved, tag]);

  return (
    <Container>
      <Title>Add tag</Title>

      <InputWrapper>
        <Input
          autoFocus
          value={tag}
          placeholder="Enter a tag"
          onChange={(event) => {
            setTag(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleAddTag();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </InputWrapper>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Actions>
        <Button variant="ghost" size="medium" onClick={onCancel}>
          Cancel
        </Button>

        <Button
          variant="solid"
          size="medium"
          disabled={!tag.trim() || isSaving}
          onClick={() => void handleAddTag()}
        >
          {isSaving ? 'Adding...' : 'Add'}
        </Button>
      </Actions>
    </Container>
  );
};
