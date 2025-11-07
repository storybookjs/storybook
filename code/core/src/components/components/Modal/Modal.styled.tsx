import type { ComponentProps } from 'react';
import React, { useContext } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { CrossIcon } from '@storybook/icons';

import { Heading } from 'react-aria-components/patched-dist/Heading';
import { Text } from 'react-aria-components/patched-dist/Text';
import type { TransitionStatus } from 'react-transition-state';
import { keyframes, styled } from 'storybook/theming';

import { Button } from '../Button/Button';
// Import the ModalContext from the main Modal component
import { ModalContext } from './Modal';

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const fadeOut = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
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

const zoomOut = keyframes({
  from: {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
  to: {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.9)',
  },
});

const slideFromBottom = keyframes({
  from: {
    opacity: 0,
    maxHeight: '0px',
  },
  to: {
    opacity: 1,
    maxHeight: '80vh',
  },
});

const slideToBottom = keyframes({
  from: {
    opacity: 1,
    maxHeight: '80vh',
  },
  to: {
    opacity: 0,
    maxHeight: '0px',
  },
});

export const Overlay = styled.div<{
  $status?: TransitionStatus;
  $transitionDuration?: number;
}>(({ $status, $transitionDuration }) => ({
  backdropFilter: 'blur(24px)',
  background: 'rgba(0, 0, 0, 0.4)',
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: 90,
  '@media (prefers-reduced-motion: no-preference)': {
    animation:
      $status === 'exiting' || $status === 'preExit'
        ? `${fadeOut} ${$transitionDuration}ms`
        : `${fadeIn} ${$transitionDuration}ms`,
    animationFillMode: 'forwards',
  },
}));

export const Container = styled.div<{
  $variant: 'dialog' | 'bottom-drawer';
  $status?: TransitionStatus;
  $transitionDuration?: number;
  width?: number | string;
  height?: number | string;
}>(
  ({ theme }) => ({
    backgroundColor: theme.background.bar,
    borderRadius: 6,
    boxShadow: '0px 4px 67px 0px #00000040',
    position: 'absolute',
    overflow: 'auto',
    zIndex: 100,

    '&:focus-visible': {
      outline: 'none',
    },
  }),
  ({ width, height, $variant, $status, $transitionDuration }) =>
    $variant === 'dialog'
      ? {
          top: '50%',
          left: '50%',
          width: width ?? 740,
          height: height ?? 'auto',
          maxWidth: 'calc(100% - 40px)',
          maxHeight: '85vh',
          '@media (prefers-reduced-motion: no-preference)': {
            willChange: 'transform, opacity',
            animationTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
            animation:
              $status === 'exiting' || $status === 'preExit'
                ? `${zoomOut} ${$transitionDuration}ms`
                : `${zoomIn} ${$transitionDuration}ms`,
            animationFillMode: 'forwards !important',
          },
          '@media (prefers-reduced-motion: reduce)': {
            transform: 'translate(-50%, -50%) scale(1)',
          },
        }
      : {
          bottom: '0',
          left: '0',
          right: '0',
          width: width ?? '100%',
          height: height ?? '80%',
          interpolateSize: 'allow-keywords',
          maxWidth: '100%',
          '@media (prefers-reduced-motion: no-preference)': {
            animationTimingFunction: 'cubic-bezier(.9,.16,.77,.64)',
            animation:
              $status === 'exiting' || $status === 'preExit'
                ? `${slideToBottom} ${$transitionDuration}ms`
                : `${slideFromBottom} ${$transitionDuration}ms`,
            animationFillMode: 'forwards !important',
          },
        }
);

interface CloseProps {
  asChild?: boolean;
  children?: React.ReactElement<
    {
      onClick?: (event: React.MouseEvent) => void;
    },
    | string
    | React.JSXElementConstructor<{
        onClick?: (event: React.MouseEvent) => void;
      }>
  >;
  onClick?: (event: React.MouseEvent) => void;
}

export const Close = ({ asChild, children, onClick, ...props }: CloseProps) => {
  const { close } = useContext(ModalContext);

  if (asChild && React.isValidElement(children)) {
    const handleClick = (event: React.MouseEvent) => {
      onClick?.(event);
      children.props.onClick?.(event);
      close?.();
    };

    return React.cloneElement(children, {
      ...props,
      onClick: handleClick,
    });
  }

  return (
    <Button
      padding="small"
      ariaLabel="Close modal"
      variant="ghost"
      shortcut={['Escape']}
      onClick={close}
    >
      <CrossIcon />
    </Button>
  );
};

export const Dialog = {
  Close: () => {
    deprecate('Modal.Dialog.Close is deprecated, please use Modal.Close instead.');
    return <Close />;
  },
};

export const CloseButton = ({ ariaLabel, ...props }: React.ComponentProps<typeof Button>) => {
  deprecate('Modal.CloseButton is deprecated, please use Modal.Close instead.');

  return (
    <Close asChild>
      <Button ariaLabel={ariaLabel || 'Close'} {...props}>
        <CrossIcon />
      </Button>
    </Close>
  );
};

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

export const Header = ({
  hasClose = true,
  ...props
}: React.ComponentProps<typeof Col> & { hasClose?: boolean }) => (
  <Row>
    <Col {...props} />
    {hasClose && <Close />}
  </Row>
);

export const Title = styled((props: ComponentProps<typeof Heading>) => (
  <Heading level={2} {...props} />
))(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s3,
  fontWeight: theme.typography.weight.bold,
}));

export const Description = styled(Text)(({ theme }) => ({
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
  '@media (prefers-reduced-motion: no-preference)': {
    animation: `${expand} 300ms, ${fadeIn} 300ms`,
  },
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
