import type { DOMAttributes, ReactElement, ReactNode } from 'react';
import React, { useCallback, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { Focusable } from '@react-aria/interactions';
import {
  TooltipTrigger,
  Tooltip as TooltipUpstream,
} from 'react-aria-components/patched-dist/Tooltip';

import { type PopperPlacement, convertToReactAriaPlacement } from '../shared/overlayHelpers';

export interface TooltipProviderProps {
  /** Tooltips trigger on hover and focus by default. To trigger on focus only, set this to `true`. */
  triggerOnFocusOnly?: boolean;

  /** Distance between the trigger and tooltip. Customize only if you have a good reason to. */
  offset?: number;

  /**
   * Placement of the tooltip. Start and End variants involve additional JS dimension calculations
   * and should be used sparingly. Left and Right get inverted in RTL.
   */
  placement?: PopperPlacement;

  /** Tooltip content */
  tooltip: ReactNode;

  /** Tooltip trigger, must be a single child that can receive focus and click/key events. */
  children: ReactElement<DOMAttributes<Element>, string>;

  /** Delay before showing the tooltip, defaults to 200ms. Always instant on focus. */
  delayShow?: number;

  /** Delay before hiding the tooltip, defaults to 400ms. */
  delayHide?: number;

  /** Uncontrolled state: whether the tooltip is visible by default. */
  defaultVisible?: boolean;

  /** Deprecated property - use defaultVisible instead. */
  startOpen?: boolean;

  /** Controlled state: whether the tooltip is visible. */
  visible?: boolean;

  /** Controlled state: fires when user interaction causes the tooltip to change visibility. */
  onVisibleChange?: (isVisible: boolean) => void;
}

const TooltipProvider = ({
  triggerOnFocusOnly = false,
  placement: placementProp = 'top',
  offset = 8,
  tooltip,
  children,
  defaultVisible,
  startOpen,
  delayShow = 400,
  delayHide = 200,
  visible,
  onVisibleChange,
  ...props
}: TooltipProviderProps) => {
  const placement = convertToReactAriaPlacement(placementProp);
  const child = React.Children.only(children);

  if (startOpen !== undefined) {
    deprecate('The `startOpen` prop is deprecated. Please use `defaultVisible` instead.');
  }

  const [isOpen, setIsOpen] = useState(defaultVisible ?? startOpen ?? false);
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsOpen(isOpen);
      onVisibleChange?.(isOpen);
    },
    [onVisibleChange]
  );

  return (
    <TooltipTrigger
      delay={delayShow}
      closeDelay={delayHide}
      isOpen={visible ?? isOpen}
      onOpenChange={onOpenChange}
      trigger={triggerOnFocusOnly ? 'focus' : undefined}
      {...props}
    >
      {/* We don't let react-aria set an aria-describedby attribute because it clashes with our intention to explicitly set an aria-label that can be different from the tooltip copy. Some screenreaders would announce the label AND description if we also allowed aria-describedby, which would decrease usability. */}
      {/* @ts-expect-error: We have to nullify aria-describedby and this is the only way we can do it (undefined won't work and an empty string will result in DOM pollution). */}
      <Focusable>{React.cloneElement(child, { 'aria-describedby': null })}</Focusable>
      <TooltipUpstream
        data-testid="tooltip"
        placement={placement}
        offset={offset}
        onOpenChange={onOpenChange}
        style={{ outline: 'none' }}
        {...props}
      >
        {tooltip}
      </TooltipUpstream>
    </TooltipTrigger>
  );
};

export { TooltipProvider };
