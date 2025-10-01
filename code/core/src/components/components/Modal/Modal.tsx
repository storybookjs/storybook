import React, { type HTMLAttributes, createContext, useEffect, useState } from 'react';

import type { DecoratorFunction } from 'storybook/internal/csf';

import { UNSAFE_PortalProvider } from '@react-aria/overlays';
import { useTransitionState } from 'react-transition-state';

import { useMediaQuery } from '../../../manager/hooks/useMedia';
import * as Components from './Modal.styled';

// import { Dialog, ModalOverlay, Modal as ModalUpstream } from 'react-aria-components';
const Dialog = (props: any) => <div {...props} />;
const ModalOverlay = (props: any) => <div {...props} />;
const ModalUpstream = (props: any) => <div {...props} />;

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  /** Width of the Modal. Defaults to `740`. */
  width?: number | string;

  /** Height of the Modal. Defaults to `auto`. */
  height?: number | string;

  /** Modal content. */
  children: React.ReactNode;

  /** Additional class names for the Modal. */
  className?: string;

  /** Controlled state: whether the Modal is currently open. */
  open?: boolean;

  /** Uncontrolled state: whether the Modal is initially open on the first. */
  defaultOpen?: boolean;

  /** Handler called when visibility of the Modal changes. */
  onOpenChange?: (isOpen: boolean) => void;

  /** The accessible name for the modal. */
  ariaLabel: string;

  /** Whether the modal can be dismissed by clicking outside. Defaults to `true`. */
  dismissOnClickOutside?: boolean;

  /** Whether the modal can be dismissed by pressing Escape. Defaults to `true`. */
  dismissOnEscape?: boolean;

  /** Transition duration, so we can slow down transitions on mobile. */
  transitionDuration?: number;

  /** The max dimensions, initial position and animations of the Modal. Defaults to 'dialog'. */
  variant?: 'dialog' | 'bottom-drawer';
}

// Create a context to provide the close function like Radix Dialog
export const ModalContext = createContext<{ close?: () => void }>({});

function BaseModal({
  children,
  width,
  height,
  ariaLabel,
  dismissOnClickOutside = true,
  dismissOnEscape = true,
  className,
  open,
  onOpenChange,
  defaultOpen,
  transitionDuration = 200,
  variant = 'dialog',
  ...props
}: ModalProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [{ status, isMounted }, toggle] = useTransitionState({
    timeout: reducedMotion ? 0 : transitionDuration,
    mountOnEnter: true,
    unmountOnExit: true,
  });

  const close = () => {
    handleOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    toggle(isOpen);
    onOpenChange?.(isOpen);
  };

  // Sync external open state with transition state
  useEffect(() => {
    const shouldBeOpen = open ?? defaultOpen ?? false;
    if (shouldBeOpen && !isMounted) {
      toggle(true);
    } else if (!shouldBeOpen && isMounted) {
      toggle(false);
    }
  }, [open, defaultOpen, isMounted, toggle]);

  // Call onOpenChange ourselves when the modal is initially opened, as react-aria won't.
  useEffect(() => {
    if (isMounted && (open || defaultOpen)) {
      onOpenChange?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  if (!isMounted || status === 'exited' || status === 'unmounted') {
    return null;
  }

  return (
    <ModalOverlay
      defaultOpen={defaultOpen}
      isOpen={open || isMounted}
      onOpenChange={handleOpenChange}
      isDismissable={dismissOnClickOutside}
      isKeyboardDismissDisabled={!dismissOnEscape}
    >
      <Components.Overlay $status={status} $transitionDuration={transitionDuration} />
      <ModalUpstream>
        <Dialog aria-label={ariaLabel}>
          <ModalContext.Provider value={{ close }}>
            <Components.Container
              $variant={variant}
              $status={status}
              $transitionDuration={transitionDuration}
              className={className}
              width={width}
              height={height}
              {...props}
            >
              {children}
            </Components.Container>
          </ModalContext.Provider>
        </Dialog>
      </ModalUpstream>
    </ModalOverlay>
  );
}

export const Modal = Object.assign(BaseModal, Components);

/**
 * Storybook decorator to help render Modals in stories with multiple theme layouts. Internal to
 * Storybook. Use at your own risk.
 */
export const ModalDecorator: DecoratorFunction = (Story, { args }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <>
      <UNSAFE_PortalProvider getContainer={() => container}>
        <Story args={args} />
      </UNSAFE_PortalProvider>
      <div
        ref={(element) => setContainer(element ?? null)}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '600px',
          transform: 'translateZ(0)',
        }}
      ></div>
    </>
  );
};
