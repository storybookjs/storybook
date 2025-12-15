import React, { type HTMLAttributes, createContext, useEffect, useRef, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';
import type { DecoratorFunction } from 'storybook/internal/csf';

import { FocusScope } from '@react-aria/focus';
import {
  Overlay,
  UNSAFE_PortalProvider,
  ariaHideOutside,
  useModalOverlay,
} from '@react-aria/overlays';
import { mergeProps } from '@react-aria/utils';
import { useOverlayTriggerState } from '@react-stately/overlays';
import type { KeyboardEvent as RAKeyboardEvent } from '@react-types/shared';
import { useTransitionState } from 'react-transition-state';

import { useMediaQuery } from '../../../manager/hooks/useMedia';
import * as Components from './Modal.styled';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  container?: HTMLElement;

  portalSelector?: string;

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

  /** @deprecated Use `dismissOnEscape` instead. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;

  /** @deprecated Use `dismissOnInteractOutside` instead. */
  onInteractOutside?: (event: FocusEvent | MouseEvent | TouchEvent) => void;

  /** Handler called when visibility of the Modal changes. */
  onOpenChange?: (isOpen: boolean) => void;

  // TODO: Storybook 11, make this required
  /** The accessible name for the modal. */
  ariaLabel?: string;

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
  container,
  portalSelector,
  children,
  width,
  height,
  ariaLabel,
  dismissOnClickOutside = true,
  dismissOnEscape = true,
  className,
  open,
  onEscapeKeyDown,
  onInteractOutside,
  onOpenChange,
  defaultOpen,
  transitionDuration = 200,
  variant = 'dialog',
  ...props
}: ModalProps) {
  let deprecated = undefined;
  if (ariaLabel === undefined || ariaLabel === '') {
    deprecated = 'ariaLabel';
    deprecate('The `ariaLabel` prop on `Modal` will become mandatory in Storybook 11.');
    // TODO in Storybook 11
    // throw new Error(
    //   'Modal requires an ARIA label to be accessible. Please provide a valid ariaLabel prop.'
    // );
  }

  if (onEscapeKeyDown !== undefined) {
    deprecated = 'onEscapeKeyDown';
    deprecate(
      'The `onEscapeKeyDown` prop is deprecated and will be removed in Storybook 11. Use `dismissOnEscape` instead.'
    );
  }

  if (onInteractOutside !== undefined) {
    deprecated = 'onInteractOutside';
    deprecate(
      'The `onInteractOutside` prop is deprecated and will be removed in Storybook 11. Use `dismissOnInteractOutside` instead.'
    );
  }

  const overlayRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [{ status, isMounted }, toggle] = useTransitionState({
    timeout: reducedMotion ? 0 : transitionDuration,
    mountOnEnter: true,
    unmountOnExit: true,
  });

  // Create state for the overlay trigger
  const state = useOverlayTriggerState({
    isOpen: open || isMounted,
    defaultOpen,
    onOpenChange: (isOpen: boolean) => {
      toggle(isOpen);
      onOpenChange?.(isOpen);
    },
  });

  const close = () => {
    state.close();
  };

  const { modalProps, underlayProps } = useModalOverlay(
    {
      isDismissable: dismissOnClickOutside,
      isKeyboardDismissDisabled: true,
      shouldCloseOnInteractOutside: onInteractOutside
        ? (element: Element) => {
            const mockedEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              relatedTarget: element,
            });
            onInteractOutside(mockedEvent);
            return !mockedEvent.defaultPrevented;
          }
        : undefined,
    },
    state,
    overlayRef
  );

  // Sync external open state with transition state
  useEffect(() => {
    const shouldBeOpen = open ?? defaultOpen ?? false;
    if (shouldBeOpen && !isMounted) {
      toggle(true);
    } else if (!shouldBeOpen && isMounted) {
      toggle(false);
    }
  }, [open, defaultOpen, isMounted, toggle]);

  // Call onOpenChange ourselves when the modal is initially opened
  useEffect(() => {
    if (isMounted && (open || defaultOpen)) {
      onOpenChange?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  useEffect(() => {
    if (isMounted && (open || defaultOpen) && overlayRef.current) {
      return ariaHideOutside([overlayRef.current], { shouldUseInert: true });
    }
  }, [isMounted, open, defaultOpen, overlayRef]);

  if (!isMounted || status === 'exited' || status === 'unmounted') {
    return null;
  }

  const finalModalProps = mergeProps(modalProps, {
    onKeyDown: (e: RAKeyboardEvent) => {
      if (e.key !== 'Escape') {
        modalProps.onKeyDown?.(e);
      } else {
        if (dismissOnEscape) {
          onEscapeKeyDown?.(e.nativeEvent);
          if (!e.nativeEvent.defaultPrevented) {
            close();
          }
        }
      }
    },
  });

  const containerElement =
    container ?? (portalSelector ? document.querySelector<HTMLElement>(portalSelector) : undefined);

  return (
    <Overlay disableFocusManagement portalContainer={containerElement || undefined}>
      {/* Overlay won't place focus within the modal on its own, and so its own FocusScope
       starts cycling through focusable elements only after we've clicked or tabbed into the modal.
       So we use our own focus scope and autofocus within on mount. */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <FocusScope restoreFocus contain autoFocus>
        <Components.Overlay
          $status={status}
          $transitionDuration={transitionDuration}
          {...underlayProps}
        />
        <div role="dialog" aria-label={ariaLabel} ref={overlayRef} {...finalModalProps}>
          <ModalContext.Provider value={{ close }}>
            {/* We need to set the FocusScope ourselves somehow, Overlay won't set it. */}
            <Components.Container
              data-deprecated={deprecated}
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
        </div>
      </FocusScope>
    </Overlay>
  );
}

export const Modal = Object.assign(BaseModal, Components);

/**
 * Storybook decorator to help render Modals in stories with multiple theme layouts. Internal to
 * Storybook. Use at your own risk.
 */
export const ModalDecorator: DecoratorFunction = (Story, { args }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  if (args.container || args.portalSelector) {
    return <Story {...{ args }} />;
  }

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
