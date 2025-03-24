import React, { useContext } from 'react';

import { Button, IconButton, Modal } from 'storybook/internal/components';

import { CloseIcon, SyncIcon } from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { DOCUMENTATION_FATAL_ERROR_LINK } from '../constants';
import type { ErrorLike, StoreState } from '../types';

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
  wordWrap: 'break-word',
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
}>({
  isModalOpen: false,
  setModalOpen: () => {},
});

interface GlobalErrorModalProps {
  onRerun: () => void;
  storeState: StoreState;
}

function ErrorCause({ error }: { error: ErrorLike }) {
  if (!error) {
    return null;
  }

  return (
    <div>
      <h4>
        Caused by: {error.name || 'Error'}: {error.message}
      </h4>
      {error.stack && <pre>{error.stack}</pre>}
      {error.cause && <ErrorCause error={error.cause} />}
    </div>
  );
}

export function GlobalErrorModal({ onRerun, storeState }: GlobalErrorModalProps) {
  const api = useStorybookApi();
  const { isModalOpen, setModalOpen } = useContext(GlobalErrorContext);
  const handleClose = () => setModalOpen(false);

  const troubleshootURL = api.getDocsUrl({
    subpath: DOCUMENTATION_FATAL_ERROR_LINK,
    versioned: true,
    renderer: true,
  });

  const {
    fatalError,
    currentRun: { unhandledErrors },
  } = storeState;

  const content = fatalError ? (
    <>
      <h3>{fatalError.error.name || 'Error'}</h3>
      {fatalError.message && <p>{fatalError.message}</p>}
      {fatalError.error.message && <p>{fatalError.error.message}</p>}
      {fatalError.error.stack && <p>{fatalError.error.stack}</p>}
      {fatalError.error.cause && <ErrorCause error={fatalError.error.cause} />}
    </>
  ) : unhandledErrors.length > 0 ? (
    <ol>
      {unhandledErrors.map((error) => (
        <li key={error.name + error.message}>
          <h3>{error.message}</h3>
          {error.VITEST_TEST_PATH && (
            <p>
              This error originated in "<b>{error.VITEST_TEST_PATH}</b>"". It doesn't mean the error
              was thrown inside the file itself, but while it was running.
            </p>
          )}
          {error.VITEST_TEST_NAME && (
            <p>
              The latest test that might've caused the error is "<b>{error.VITEST_TEST_NAME}</b>".
              <br />
              It might mean one of the following:
              <ul>
                <li>The error was thrown, while Vitest was running this test.</li>
                <li>
                  If the error occurred after the test had been completed, this was the last
                  documented test before it was thrown.
                </li>
              </ul>
            </p>
          )}
          <p>{error.stack}</p>
        </li>
      ))}
    </ol>
  ) : null;

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
        {content}
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
