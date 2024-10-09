import React from 'react';

import { Button, IconButton, Modal } from 'storybook/internal/components';

import { CloseIcon, SyncIcon } from '@storybook/icons';
import { styled } from '@storybook/theming';

interface GlobalErrorModalProps {
  error: string;
  open: boolean;
  onClose: () => void;
  onRerun: () => void;
}

const ModalBar = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 6px 6px 20px',
});

const ModalActionBar = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const ModalTitle = styled.div(({ theme: { typography } }) => ({
  fontSize: typography.size.s2,
  fontWeight: typography.weight.bold,
}));

const ModalStackTrace = styled.pre(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  overflow: 'auto',
  maxHeight: '60vh',
  margin: 0,
  padding: `20px`,
  fontFamily: theme.typography.fonts.mono,
  fontSize: '12px',
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const TroubleshootLink = styled.a(({ theme }) => ({
  color: theme.color.defaultText,
}));

const TROUBLESHOOT_LINK = `https://storybook.js.org/docs/vitest/troubleshooting`;

export function GlobalErrorModal({ onRerun, onClose, error, open }: GlobalErrorModalProps) {
  return (
    <Modal onEscapeKeyDown={onClose} onInteractOutside={onClose} open={open}>
      <ModalBar>
        <ModalTitle>Storybook Tests error details</ModalTitle>
        <ModalActionBar>
          <Button onClick={onRerun} variant="ghost">
            <SyncIcon />
            Rerun
          </Button>
          <Button variant="ghost" asChild>
            {/* TODO: Is this the right link? */}
            <a target="_blank" href={TROUBLESHOOT_LINK} rel="noreferrer">
              Troubleshoot
            </a>
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </ModalActionBar>
      </ModalBar>
      <ModalStackTrace>
        {error}
        <br />
        <br />
        Troubleshoot:{' '}
        <TroubleshootLink target="_blank" href={TROUBLESHOOT_LINK}>
          {TROUBLESHOOT_LINK}
        </TroubleshootLink>
      </ModalStackTrace>
    </Modal>
  );
}
