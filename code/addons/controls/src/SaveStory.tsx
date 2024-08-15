import React from 'react';

import {
  Bar as BaseBar,
  Button,
  Form,
  IconButton,
  Modal,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import { keyframes, styled } from 'storybook/internal/theming';

import { AddIcon, CheckIcon, UndoIcon } from '@storybook/icons';

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
  position: 'sticky',
  bottom: 0,
  height: 39,
  overflow: 'hidden',
  zIndex: 1,
});

const Bar = styled(BaseBar)(({ theme }) => ({
  '--highlight-bg-color': theme.base === 'dark' ? '#153B5B' : '#E0F0FF',
  display: 'flex',
  flexDirection: 'row-reverse', // hide Info rather than Actions on overflow
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 6,
  padding: '6px 10px',
  animation: `${slideIn} 300ms, ${highlight} 2s`,
  background: theme.background.bar,
  borderTop: `1px solid ${theme.appBorderColor}`,
  fontSize: theme.typography.size.s2,

  '@container (max-width: 799px)': {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));

const Info = styled.div({
  display: 'flex',
  flex: '99 0 auto',
  alignItems: 'center',
  marginLeft: 10,
  gap: 6,
});

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  flex: '1 0 0',
  alignItems: 'center',
  gap: 2,
  color: theme.color.mediumdark,
  fontSize: theme.typography.size.s2,
}));

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

const ModalInput = styled(Form.Input)(({ theme }) => ({
  '::placeholder': {
    color: theme.color.mediumdark,
  },
  '&:invalid:not(:placeholder-shown)': {
    boxShadow: `${theme.color.negative} 0 0 0 1px inset`,
  },
}));

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

  return (
    <Container id="save-from-controls">
      <Bar>
        <Actions>
          <WithTooltip
            as="div"
            hasChrome={false}
            trigger="hover"
            tooltip={<TooltipNote note="Save changes to story" />}
          >
            <IconButton aria-label="Save changes to story" disabled={saving} onClick={onSaveStory}>
              <CheckIcon />
              <Label data-short-label="Save">Update story</Label>
            </IconButton>
          </WithTooltip>

          <WithTooltip
            as="div"
            hasChrome={false}
            trigger="hover"
            tooltip={<TooltipNote note="Create new story with these settings" />}
          >
            <IconButton aria-label="Create new story with these settings" onClick={onShowForm}>
              <AddIcon />
              <Label data-short-label="New">Create new story</Label>
            </IconButton>
          </WithTooltip>

          <WithTooltip
            as="div"
            hasChrome={false}
            trigger="hover"
            tooltip={<TooltipNote note="Reset changes" />}
          >
            <IconButton aria-label="Reset changes" onClick={() => resetArgs()}>
              <UndoIcon />
              <span>Reset</span>
            </IconButton>
          </WithTooltip>
        </Actions>

        <Info>
          <Label data-short-label="Unsaved changes">
            You modified this story. Do you want to save your changes?
          </Label>
        </Info>

        <Modal width={350} open={creating} onOpenChange={setCreating}>
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
                <Button disabled={saving || !storyName} size="medium" type="submit" variant="solid">
                  Create
                </Button>
                <Modal.Dialog.Close asChild>
                  <Button disabled={saving} size="medium" type="reset">
                    Cancel
                  </Button>
                </Modal.Dialog.Close>
              </Modal.Actions>
            </Modal.Content>
          </Form>
          {errorMessage && <Modal.Error>{errorMessage}</Modal.Error>}
        </Modal>
      </Bar>
    </Container>
  );
};
