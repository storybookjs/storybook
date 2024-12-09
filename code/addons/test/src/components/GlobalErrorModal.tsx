import React, { useContext } from 'react';

import { Button, IconButton, Modal } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { CloseIcon, SyncIcon } from '@storybook/icons';

import { DOCUMENTATION_FATAL_ERROR_LINK } from '../constants';

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
  borderRadius: 0,
}));

const TroubleshootLink = styled.a(({ theme }) => ({
  color: theme.color.defaultText,
}));

export const GlobalErrorContext = React.createContext<{
  isModalOpen: boolean;
  setModalOpen: (isOpen: boolean) => void;
  error?: string;
}>({
  isModalOpen: false,
  setModalOpen: () => {},
  error: undefined,
});

interface GlobalErrorModalProps {
  onRerun: () => void;
}

export function GlobalErrorModal({ onRerun }: GlobalErrorModalProps) {
  const api = useStorybookApi();
  const { error, isModalOpen, setModalOpen } = useContext(GlobalErrorContext);
  const handleClose = () => setModalOpen(false);

  const troubleshootURL = api.getDocsUrl({
    subpath: DOCUMENTATION_FATAL_ERROR_LINK,
    versioned: true,
    renderer: true,
  });

  return (
    <Modal onEscapeKeyDown={handleClose} onInteractOutside={handleClose} open={isModalOpen}>
      <ModalBar>
        <ModalTitle>Storybook Tests error details</ModalTitle>
        <ModalActionBar>
          <Button onClick={onRerun} variant="ghost">
            <SyncIcon />
            Rerun
          </Button>
          <Button variant="ghost" asChild>
            <a target="_blank" href={troubleshootURL} rel="noreferrer">
              Troubleshoot
            </a>
          </Button>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </ModalActionBar>
      </ModalBar>
      <ModalStackTrace>
        {error}
        <br />
        <br />
        Troubleshoot:{' '}
        <TroubleshootLink target="_blank" href={troubleshootURL}>
          {troubleshootURL}
        </TroubleshootLink>
      </ModalStackTrace>
    </Modal>
  );
}
