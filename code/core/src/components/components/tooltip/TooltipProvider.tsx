import type { DOMAttributes, ReactElement, ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { Focusable } from 'react-aria-components/Focusable';
import { TooltipTrigger, Tooltip as TooltipUpstream } from 'react-aria-components/Tooltip';

import { type PopperPlacement, convertToReactAriaPlacement } from '../shared/overlayHelpers.tsx';

export interface TooltipProviderProps {
  /** Tooltips trigger on hover and focus by default. To trigger on focus only, set this to `true`. */
  triggerOnFocusOnly?: boolean;

  /**
   * Whether the tooltip is prevented from opening. Turning this on closes an open tooltip.
   *
   * Prefer this over `visible={false}` for temporary suppression: a controlled `visible` also
   * stops react-aria from reporting state changes, and the tooltip can reopen unprompted when
   * control is released.
   */
  disabled?: boolean;

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
  disabled = false,
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

  // Hide the tooltip on any pointer press in the document. react-aria hides the tooltip only when
  // the pointer leaves the trigger or presses it. A press elsewhere can hide or replace the
  // trigger, and the tooltip then stays open next to a hidden trigger.
  const isTooltipShown = visible ?? isOpen;
  useEffect(() => {
    if (!isTooltipShown) {
      return;
    }
    const onPointerDown = () => onOpenChange(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isTooltipShown, onOpenChange]);

  // react-aria consumes isDisabled in the trigger interactions only: it stops new opens, and it
  // leaves a tooltip that is already open on screen. Close that one here.
  useEffect(() => {
    if (disabled && isTooltipShown) {
      onOpenChange(false);
    }
  }, [disabled, isTooltipShown, onOpenChange]);

  // Hide the tooltip the moment its trigger loses its box, such as a row-action button that is
  // display: none unless its row is hovered. An open tooltip is positioned against the trigger's
  // rect, and a collapsed rect places it at the viewport origin for the rest of the close delay.
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = triggerRef.current;
    if (!isTooltipShown || !el) {
      return;
    }
    const closeWhenBoxless = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        onOpenChange(false);
      }
    };
    closeWhenBoxless();
    const resizeObserver = new ResizeObserver(closeWhenBoxless);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [isTooltipShown, onOpenChange]);

  const childRef =
    parseInt(React.version, 10) < 19
      ? (child as unknown as { ref?: React.Ref<HTMLElement> }).ref
      : (child.props as { ref?: React.Ref<HTMLElement> }).ref;
  const setTriggerRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    if (typeof childRef === 'function') {
      childRef(node);
    } else if (childRef && typeof childRef === 'object') {
      (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
    }
  };

  return (
    <TooltipTrigger
      delay={delayShow}
      closeDelay={delayHide}
      isDisabled={disabled}
      isOpen={visible ?? isOpen}
      onOpenChange={onOpenChange}
      trigger={triggerOnFocusOnly ? 'focus' : undefined}
      {...props}
    >
      {/* We don't let react-aria set an aria-describedby attribute because it clashes with our intention to explicitly set an aria-label that can be different from the tooltip copy. Some screenreaders would announce the label AND description if we also allowed aria-describedby, which would decrease usability. */}
      {/* The cast covers two intentional deviations: aria-describedby must be null (undefined
          won't work and an empty string pollutes the DOM), and cloneElement's typings admit no
          ref for a generically typed child. */}
      <Focusable>
        {
          React.cloneElement(child, {
            'aria-describedby': null,
            ref: setTriggerRef,
          } as unknown as Partial<DOMAttributes<Element>>) as React.ComponentProps<
            typeof Focusable
          >['children']
        }
      </Focusable>
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
