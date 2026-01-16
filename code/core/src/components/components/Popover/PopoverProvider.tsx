import type { DOMAttributes, ReactElement, ReactNode } from 'react';
import React, { cloneElement, useCallback, useState } from 'react';
import type { FocusableElement } from '@react-types/shared';

import { deprecate } from 'storybook/internal/client-logger';

import { Pressable } from '@react-aria/interactions';
import { DialogTrigger } from 'react-aria-components/patched-dist/Dialog';
import { Popover as PopoverUpstream } from 'react-aria-components/patched-dist/Popover';

import { type PopperPlacement, convertToReactAriaPlacement } from '../shared/overlayHelpers';
import { Popover } from './Popover';

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
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsOpen(isOpen);
      onVisibleChange?.(isOpen);
    },
    [onVisibleChange]
  );
  const onHide = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <DialogTrigger
      defaultOpen={defaultVisible}
      isOpen={visible ?? isOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      <Pressable>
        {
          /* React-aria does not inject aria-haspopup='dialog' to support legacy screen readers, so we do it ourselves. */
          cloneElement(
            children,
            // @ts-expect-error aria-haspopup is a valid ARIA attribute but cloneElement types are too strict
            { 'aria-haspopup': 'dialog' }
          )
        }
      </Pressable>
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
