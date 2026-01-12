import React from 'react';

import { Bar as BaseBar, Button, Form, Modal } from 'storybook/internal/components';

import { AddIcon, CheckIcon, UndoIcon } from '@storybook/icons';

import { keyframes, styled } from 'storybook/theming';

const slideIn = keyframes({
  from: { transform: 'translateY(40px)' },
  to: { transform: 'translateY(0)' },
});

const highlight = keyframes({
  from: { background: 'var(--highlight-bg-color)' },
  to: {},
});

const Container = styled.div({
  containerType: 'size',
  position: 'absolute',
  bottom: 0,
  width: '100%',
  height: 41,
  overflow: 'hidden',
  zIndex: 1,
});

const Bar = styled(BaseBar)(({ theme }) => ({
  '--highlight-bg-color': theme.base === 'dark' ? '#153B5B' : '#E0F0FF',
  paddingInline: 4,
  animation: `${slideIn} 300ms, ${highlight} 2s`,
  background: 'var(--sb-background-bar)',
  borderTop: `1px solid var(--sb-appBorderColor)`,
  fontSize: 'var(--sb-typography-size-s2)',

  '@container (max-width: 799px)': {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));

const Info = styled.div({
  display: 'flex',
  flex: '99 0 auto',
  alignItems: 'center',
  marginInlineStart: 7,
  marginInlineEnd: 10,
  gap: 6,
});

const Actions = styled.div({
  // We want actions to appear first and be hidden last on overflow,
  // but the screenreader reading order must start with Info.
  display: 'flex',
  flex: '1 0 0',
  alignItems: 'center',
  gap: 2,
  color: 'var(--sb-color-textMuted)',
  fontSize: 'var(--sb-typography-size-s2)',
});

const Label = styled.div({
  '@container (max-width: 799px)': {
    lineHeight: 0,
    textIndent: '-9999px',
    '&::after': {
      content: 'attr(data-short-label)',
      display: 'block',
      lineHeight: 'initial',
      textIndent: '0',
    },
  },
});

const ModalInput = styled(Form.Input)({
  '::placeholder': {
    color: 'var(--sb-color-mediumdark)',
  },
  '&:invalid:not(:placeholder-shown)': {
    boxShadow: `var(--sb-color-negative) 0 0 0 1px inset`,
  },
});

type SaveStoryProps = {
  saveStory: () => Promise<unknown>;
  createStory: (storyName: string) => Promise<unknown>;
  resetArgs: () => void;
};

export const SaveStory = ({ saveStory, createStory, resetArgs }: SaveStoryProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [storyName, setStoryName] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState(null);

  const onSaveStory = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    await saveStory().catch(() => {});
    setSaving(false);
  };

  const onShowForm = () => {
    setCreating(true);
    setStoryName('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace(/^[^a-z]/i, '')
      .replace(/[^a-z0-9-_ ]/gi, '')
      .replaceAll(/([-_ ]+[a-z0-9])/gi, (match) => match.toUpperCase().replace(/[-_ ]/g, ''));
    setStoryName(value.charAt(0).toUpperCase() + value.slice(1));
  };
  const onSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }
    try {
      setErrorMessage(null);
      setSaving(true);
      await createStory(storyName.replace(/^[^a-z]/i, '').replaceAll(/[^a-z0-9]/gi, ''));
      setCreating(false);
      setSaving(false);
    } catch (e: any) {
      setErrorMessage(e.message);
      setSaving(false);
    }
  };

  const saveLabel = saving ? 'Saving changes to story' : 'Save changes to story';
  const createLabel = 'Create new story with these settings';

  return (
    <Container id="save-from-controls">
      <Bar
        innerStyle={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Actions>
          <Button ariaLabel={saveLabel} tooltip={saveLabel} disabled={saving} onClick={onSaveStory}>
            <CheckIcon />
            <Label data-short-label="Save">Update story</Label>
          </Button>

          <Button ariaLabel={createLabel} tooltip={createLabel} onClick={onShowForm}>
            <AddIcon />
            <Label data-short-label="New">Create new story</Label>
          </Button>

          <Button ariaLabel="Reset changes" onClick={() => resetArgs()}>
            <UndoIcon />
            <span>Reset</span>
          </Button>
        </Actions>

        <Modal ariaLabel="Create new story" width={350} open={creating} onOpenChange={setCreating}>
          <Form onSubmit={onSubmitForm} id="create-new-story-form">
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Create new story</Modal.Title>
                <Modal.Description>
                  This will add a new story to your existing stories file.
                </Modal.Description>
              </Modal.Header>
              <ModalInput
                onChange={onChange}
                placeholder="Story export name"
                readOnly={saving}
                ref={inputRef}
                value={storyName}
              />
              <Modal.Actions>
                <Button
                  ariaLabel={false}
                  disabled={saving || !storyName}
                  size="medium"
                  type="submit"
                  variant="solid"
                >
                  Create
                </Button>
                <Modal.Close asChild>
                  <Button ariaLabel={false} disabled={saving} size="medium" type="reset">
                    Cancel
                  </Button>
                </Modal.Close>
              </Modal.Actions>
            </Modal.Content>
          </Form>
          {errorMessage && <Modal.Error>{errorMessage}</Modal.Error>}
        </Modal>
        <Info>
          <Label data-short-label="Unsaved changes">
            You modified this story. Do you want to save your changes?
          </Label>
        </Info>
      </Bar>
    </Container>
  );
};
