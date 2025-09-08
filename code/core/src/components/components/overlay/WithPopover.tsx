import type { DOMAttributes, ReactElement, ReactNode } from 'react';
import React, { useCallback, useState } from 'react';

import { Overlay, convertToReactAriaPlacement } from 'storybook/internal/components';
import type { PopperPlacement } from 'storybook/internal/components';

import { DialogTrigger, Popover as PopoverUpstream, Pressable } from 'react-aria-components';

export interface WithPopoverProps {
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

export const WithPopover = ({
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
}: WithPopoverProps) => {
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
  const onHide = useCallback(() => setIsOpen(false), []);

  return (
    <DialogTrigger
      defaultOpen={defaultVisible}
      isOpen={visible ?? isOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      <Pressable>{children}</Pressable>
      <PopoverUpstream
        placement={placement}
        offset={offset}
        style={{ outlineColor: 'transparent' }}
      >
        <Overlay
          hasChrome={hasChrome}
          hideLabel={closeLabel}
          onHide={hasCloseButton ? onHide : undefined}
          padding={padding}
        >
          {typeof popover === 'function' ? popover({ onHide }) : popover}
        </Overlay>
      </PopoverUpstream>
    </DialogTrigger>
  );
};
