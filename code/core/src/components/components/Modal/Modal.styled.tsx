import type { ComponentProps } from 'react';
import React from 'react';

import { keyframes, styled } from '@storybook/core/theming';
import { CrossIcon } from '@storybook/icons';

import * as Dialog from '@radix-ui/react-dialog';

import { IconButton } from '../IconButton/IconButton';

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const expand = keyframes({
  from: { maxHeight: 0 },
  to: {},
});

const zoomIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.9)',
  },
  to: {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
});

export const Overlay = styled.div({
  backdropFilter: 'blur(24px)',
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: 10,
  animation: `${fadeIn} 200ms`,
});

export const Container = styled.div<{ width?: number; height?: number }>(
  ({ theme, width, height }) => ({
    backgroundColor: theme.background.bar,
    borderRadius: 6,
    boxShadow: '0px 4px 67px 0px #00000040',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: width ?? 740,
    height: height ?? 'auto',
    maxWidth: 'calc(100% - 40px)',
    maxHeight: '85vh',
    overflow: 'hidden',
    zIndex: 11,
    animation: `${zoomIn} 200ms`,

    '&:focus-visible': {
      outline: 'none',
    },
  })
);

export const CloseButton = (props: React.ComponentProps<typeof IconButton>) => (
  <Dialog.Close asChild>
    <IconButton {...props}>
      <CrossIcon />
    </IconButton>
  </Dialog.Close>
);

export const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  margin: 16,
  gap: 16,
});

export const Row = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
});

export const Col = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const Header = (props: React.ComponentProps<typeof Col>) => (
  <Row>
    <Col {...props} />
    <CloseButton />
  </Row>
);

export const Title = styled(Dialog.Title)(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s3,
  fontWeight: theme.typography.weight.bold,
}));

export const Description = styled(Dialog.Description)(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  margin: 0,
  fontSize: theme.typography.size.s2,
}));

export const Actions = styled.div({
  display: 'flex',
  flexDirection: 'row-reverse',
  gap: 8,
});

export const ErrorWrapper = styled.div(({ theme }) => ({
  maxHeight: 100,
  overflow: 'auto',
  animation: `${expand} 300ms, ${fadeIn} 300ms`,
  backgroundColor: theme.background.critical,
  color: theme.color.lightest,
  fontSize: theme.typography.size.s2,

  '& > div': {
    position: 'relative',
    padding: '8px 16px',
  },
}));

export const Error = ({
  children,
  ...props
}: { children: React.ReactNode } & ComponentProps<typeof ErrorWrapper>) => (
  <ErrorWrapper {...props}>
    <div>{children}</div>
  </ErrorWrapper>
);
