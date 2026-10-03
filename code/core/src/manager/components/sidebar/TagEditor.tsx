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

const TagList = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

const TagRow = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 28,
  padding: '2px 4px 2px 8px',
  borderRadius: theme.appBorderRadius,
  background: theme.background.hoverable,
}));

const TagName = styled.span(({ theme }) => ({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.typography.size.s1,
  color: theme.color.defaultText,
}));

const EmptyMessage = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.textMutedColor,
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
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channel = addons.getChannel();

  const tags =
    context.type === 'story' && 'tags' in context && Array.isArray(context.tags)
      ? context.tags
      : [];

  const handleAddTag = useCallback(async () => {
    if (context.type !== 'story' || !('importPath' in context) || !context.importPath) {
      return;
    }

    const normalizedTag = tag.trim();

    if (!normalizedTag || isSaving || removingTag) {
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
          tagOperation: 'add',
        }
      );

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tag could not be added');
    } finally {
      setIsSaving(false);
    }
  }, [channel, context, isSaving, onSaved, removingTag, tag]);

  const handleRemoveTag = useCallback(
    async (tagToRemove: string) => {
      if (context.type !== 'story' || !('importPath' in context) || !context.importPath) {
        return;
      }

      if (isSaving || removingTag) {
        return;
      }

      setRemovingTag(tagToRemove);
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
            tags: [tagToRemove],
            tagOperation: 'remove',
          }
        );

        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tag could not be removed');
      } finally {
        setRemovingTag(null);
      }
    },
    [channel, context, isSaving, onSaved, removingTag]
  );

  return (
    <Container>
      <Title>Manage tags</Title>

      {tags.length > 0 ? (
        <TagList>
          {tags.map((existingTag) => (
            <TagRow key={existingTag}>
              <TagName title={existingTag}>{existingTag}</TagName>

              <Button
                variant="ghost"
                size="small"
                disabled={isSaving || removingTag !== null}
                onClick={() => void handleRemoveTag(existingTag)}
              >
                {removingTag === existingTag ? 'Removing...' : 'Remove'}
              </Button>
            </TagRow>
          ))}
        </TagList>
      ) : (
        <EmptyMessage>No tags</EmptyMessage>
      )}

      <InputWrapper>
        <Input
          autoFocus
          value={tag}
          placeholder="Enter a tag"
          disabled={isSaving || removingTag !== null}
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
        <Button
          variant="ghost"
          size="medium"
          disabled={isSaving || removingTag !== null}
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          variant="solid"
          size="medium"
          disabled={!tag.trim() || isSaving || removingTag !== null}
          onClick={() => void handleAddTag()}
        >
          {isSaving ? 'Adding...' : 'Add'}
        </Button>
      </Actions>
    </Container>
  );
};
