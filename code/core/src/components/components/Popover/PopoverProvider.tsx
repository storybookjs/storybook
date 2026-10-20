import type { DOMAttributes, FocusEvent, ReactElement, ReactNode } from 'react';
import React, { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { Pressable } from 'react-aria-components/Pressable';
import { DialogTrigger } from 'react-aria-components/Dialog';
import { Popover as PopoverUpstream } from 'react-aria-components/Popover';

import {
  type PopperPlacement,
  convertToReactAriaPlacement,
  PopoverDismissalProvider,
} from '../shared/overlayHelpers.tsx';
import { Popover } from './Popover.tsx';

export interface PopoverProviderProps {
  /**
   * An accessible label for the popover dialog, announced by screen readers. This prop will become
   * mandatory in Storybook 11. Provide a concise description of the popover's purpose.
   */
  ariaLabel?: string;

  /** Whether to display the Popover in a prestyled container. True by default. */
  hasChrome?: boolean;

  /**
   * Whether to display a close button in the top right corner of the popover overlay. Can overlap
   * with overlay content, make sure to test your use case. False by default.
   */
  hasCloseButton?: boolean;

  /** Optional custom label for the close button, if there is one. */
  closeLabel?: string;

  /** Optional custom padding for the popover overlay. */
  padding?: number | string;

  /** Distance between the trigger and Popover. Customize only if you have a good reason to. */
  offset?: number;

  /**
   * Placement of the Popover. Start and End variants involve additional JS dimension calculations
   * and should be used sparingly. Left and Right get inverted in RTL.
   */
  placement?: PopperPlacement;

  /**
   * Popover content. Pass a function to receive a onHide callback to collect to your close button,
   * or if you want to wait for the popover to be opened to call your content component.
   */
  popover: ReactNode | ((props: { onHide: () => void }) => ReactNode);

  /** Popover trigger, must be a single child with click/press events. Must forward refs. */
  children: ReactElement<DOMAttributes<Element>, string>;

  /** Uncontrolled state: whether the Popover is initially visible. */
  defaultVisible?: boolean;

  /** Controlled state: whether the Popover is visible. */
  visible?: boolean;

  /** Controlled state: fires when user interaction causes the Popover to change visibility. */
  onVisibleChange?: (isVisible: boolean) => void;
}

export const PopoverProvider = ({
  ariaLabel,
  placement: placementProp = 'bottom-start',
  hasChrome = true,
  hasCloseButton = false,
  closeLabel,
  offset = 8,
  padding,
  popover,
  children,
  defaultVisible,
  visible,
  onVisibleChange,
  ...props
}: PopoverProviderProps) => {
  if (!ariaLabel) {
    deprecate(
      "The 'ariaLabel' prop on 'PopoverProvider' will become mandatory in Storybook 11. Provide a concise, accessible label describing the popover's purpose."
    );
  }

  // Map Popper.js placement to react-aria placement best we can.
  const placement = convertToReactAriaPlacement(placementProp);

  const [isOpen, setIsOpen] = useState(defaultVisible ?? false);
  const suppressFocusRestoreRef = useRef(false);

  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsOpen(isOpen);
      onVisibleChange?.(isOpen);
    },
    [onVisibleChange]
  );

  // The function only reads a ref, so a once-created object keeps identity stable for consumers
  // that memoize against it.
  const dismissal = useMemo(
    () => ({
      consumeFocusRestoreSuppression: () => {
        const suppressed = suppressFocusRestoreRef.current;
        suppressFocusRestoreRef.current = false;
        return suppressed;
      },
    }),
    []
  );
  const handleTriggerBlur = (event: FocusEvent<Element>) => {
    children.props.onBlur?.(event);
    suppressFocusRestoreRef.current = false;
  };
  // The Escape keydown that dismisses the popover would read as keyboard focus once React Aria
  // restores focus to the trigger, so suppress the tooltip that restore would open. Observed at
  // document level in the capture phase so the arming happens before the dismissal and regardless
  // of which element holds focus; only while the popover is open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        suppressFocusRestoreRef.current = true;
      }
    };
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, true);
  }, [isOpen]);
  // Typed explicitly so onBlur stays type-checked while aria-haspopup remains allowed: cloneElement
  // props only inherit the child's DOMAttributes, which does not include ARIA attributes.
  const triggerProps: DOMAttributes<Element> & { 'aria-haspopup': 'dialog' } = {
    'aria-haspopup': 'dialog',
    onBlur: handleTriggerBlur,
  };
  const onHide = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <DialogTrigger
      defaultOpen={defaultVisible}
      isOpen={visible ?? isOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      <PopoverDismissalProvider value={dismissal}>
        <Pressable
          onPressStart={() => {
            suppressFocusRestoreRef.current = false;
          }}
        >
          {/* React-aria does not inject aria-haspopup='dialog' to support legacy screen readers, so we do it ourselves. */}
          {/* @ts-expect-error cloneElement widens the element type on return, which Pressable's children reject; the merged props are type-checked at triggerProps above. */}
          {cloneElement(children, triggerProps)}
        </Pressable>
      </PopoverDismissalProvider>
      <PopoverUpstream
        aria-label={ariaLabel}
        placement={placement}
        offset={offset}
        style={{ outline: 'none' }}
      >
        <Popover
          hasChrome={hasChrome}
          hideLabel={closeLabel}
          onHide={hasCloseButton ? onHide : undefined}
          padding={padding}
        >
          {typeof popover === 'function' ? popover({ onHide }) : popover}
        </Popover>
      </PopoverUpstream>
    </DialogTrigger>
  );
};
