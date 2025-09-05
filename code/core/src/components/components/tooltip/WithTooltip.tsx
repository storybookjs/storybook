import type { ComponentProps, DOMAttributes, ReactElement, ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

import { global } from '@storybook/global';

import type { Tooltip as TooltipUpstream } from 'react-aria-components';
import { Focusable, TooltipTrigger } from 'react-aria-components';
import type { PopperOptions, Config as ReactPopperTooltipConfig } from 'react-popper-tooltip';
import { usePopperTooltip } from 'react-popper-tooltip';
import { styled } from 'storybook/theming';

import type { TooltipDbgProps } from './Tooltip';
import { Tooltip as OldTooltip, TooltipDbg } from './Tooltip';

const { document } = global;

// A target that doesn't speak popper
const TargetContainer = styled.div<{ trigger: ReactPopperTooltipConfig['trigger'] }>`
  display: inline-block;
  cursor: ${(props) =>
    props.trigger === 'hover' || props.trigger?.includes('hover') ? 'default' : 'pointer'};
`;

const TargetSvgContainer = styled.g<{ trigger: ReactPopperTooltipConfig['trigger'] }>`
  cursor: ${(props) =>
    props.trigger === 'hover' || props.trigger?.includes('hover') ? 'default' : 'pointer'};
`;

interface WithHideFn {
  onHide: () => void;
}

export interface WithTooltipPureProps
  extends Omit<ReactPopperTooltipConfig, 'closeOnOutsideClick'>,
    Omit<ComponentProps<typeof TargetContainer>, 'trigger'>,
    PopperOptions {
  svg?: boolean;
  withArrows?: boolean;
  hasChrome?: boolean;
  tooltip: ReactNode | ((p: WithHideFn) => ReactNode);
  children: ReactNode;
  onDoubleClick?: () => void;
  /**
   * If `true`, a click outside the trigger element closes the tooltip
   *
   * @default false
   */
  closeOnOutsideClick?: boolean;
  /**
   * Optional container to portal the tooltip into. Can be a CSS selector string or a DOM Element.
   * Falls back to document.body.
   */
  portalContainer?: Element | string | null;
}

// Pure, does not bind to the body
const WithTooltipPure = ({
  svg = false,
  trigger = 'click',
  closeOnOutsideClick = false,
  placement = 'top',
  modifiers = [
    {
      name: 'preventOverflow',
      options: {
        padding: 8,
      },
    },
    {
      name: 'offset',
      options: {
        offset: [8, 8],
      },
    },
    {
      name: 'arrow',
      options: {
        padding: 8,
      },
    },
  ],
  hasChrome,
  defaultVisible = false,
  withArrows,
  offset,
  tooltip,
  children,
  closeOnTriggerHidden,
  mutationObserverOptions,
  delayHide = trigger === 'hover' ? 200 : 0,
  visible,
  interactive,
  delayShow = trigger === 'hover' ? 400 : 0,
  strategy,
  followCursor,
  onVisibleChange,
  portalContainer,
  ...props
}: WithTooltipPureProps) => {
  const Container = svg ? TargetSvgContainer : TargetContainer;
  const {
    getArrowProps,
    getTooltipProps,
    setTooltipRef,
    setTriggerRef,
    visible: isVisible,
    state,
  } = usePopperTooltip(
    {
      trigger,
      placement,
      defaultVisible,
      delayHide,
      interactive,
      closeOnOutsideClick,
      closeOnTriggerHidden,
      onVisibleChange,
      delayShow,
      followCursor,
      mutationObserverOptions,
      visible,
      offset,
    },
    {
      modifiers,
      strategy,
    }
  );

  const portalTarget: Element =
    (typeof portalContainer === 'string'
      ? document.querySelector(portalContainer)
      : portalContainer) || document.body;

  const tooltipComponent = isVisible ? (
    <OldTooltip
      placement={state?.placement}
      ref={setTooltipRef}
      hasChrome={hasChrome}
      arrowProps={getArrowProps()}
      withArrows={withArrows}
      {...getTooltipProps()}
    >
      {/* @ts-expect-error (non strict) */}
      {typeof tooltip === 'function' ? tooltip({ onHide: () => onVisibleChange(false) }) : tooltip}
    </OldTooltip>
  ) : null;

  return (
    <>
      <Container trigger={trigger} ref={setTriggerRef as any} {...(props as any)}>
        {children}
      </Container>
      {isVisible && ReactDOM.createPortal(tooltipComponent, portalTarget)}
    </>
  );
};

export interface WithTooltipStateProps extends Omit<WithTooltipPureProps, 'onVisibleChange'> {
  startOpen?: boolean;
  onVisibleChange?: (visible: boolean) => void | boolean;
}

const WithToolTipState = ({
  startOpen = false,
  onVisibleChange: onChange,
  ...rest
}: WithTooltipStateProps) => {
  const [tooltipShown, setTooltipShown] = useState(startOpen);
  const onVisibilityChange = useCallback(
    (visibility: boolean) => {
      if (onChange && onChange(visibility) === false) {
        return;
      }
      setTooltipShown(visibility);
    },
    [onChange]
  );

  useEffect(() => {
    const hide = () => onVisibilityChange(false);
    document.addEventListener('keydown', hide, false);

    // Find all iframes on the screen and bind to clicks inside them (waiting until the iframe is ready)
    const iframes: HTMLIFrameElement[] = Array.from(document.getElementsByTagName('iframe'));
    const unbinders: (() => void)[] = [];
    iframes.forEach((iframe) => {
      const bind = () => {
        try {
          // @ts-expect-error (non strict)
          if (iframe.contentWindow.document) {
            // @ts-expect-error (non strict)
            iframe.contentWindow.document.addEventListener('click', hide);
            unbinders.push(() => {
              try {
                // @ts-expect-error (non strict)
                iframe.contentWindow.document.removeEventListener('click', hide);
              } catch (e) {
                // logger.debug('Removing a click listener from iframe failed: ', e);
              }
            });
          }
        } catch (e) {
          // logger.debug('Adding a click listener to iframe failed: ', e);
        }
      };

      bind(); // I don't know how to find out if it's already loaded so I potentially will bind twice
      iframe.addEventListener('load', bind);
      unbinders.push(() => {
        iframe.removeEventListener('load', bind);
      });
    });

    return () => {
      document.removeEventListener('keydown', hide);
      unbinders.forEach((unbind) => {
        unbind();
      });
    };
  });

  return <WithTooltipPure {...rest} visible={tooltipShown} onVisibleChange={onVisibilityChange} />;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////

// TODO: create file
export interface WithPopoverProps {
  // not actually needed
  trigger: 'click';
  placement: TooltipDbgProps['placement'];
}

// TODO: filter out aria-describedby from Tooltip trigger attrs
// TODO: migrate all uses of Tooltip trigger="click" to WithPopover
// TODO: migrate core/src/manager/components/sidebar/RefBlocks.tsx ErrorBlock to a dialog or popover (does not close on outside click)

// BREAKING: WithTooltipState and WithTooltipPure were removed. Use WithTooltip instead.
// BREAKING: The trigger prop now only accepts "focus" and "hover-and-focus". Tooltips now always show on focus for accessibility reasons. Use WithPopover for click-triggered popovers.
// BREAKING: The `svg` prop was removed because it was unused.
// BREAKING: The `startOpen` prop was removed because it was unused.
// BREAKING: The `defaultVisible` prop was removed because it was unused.
// BREAKING: The `withArrows` prop was removed because it was unused.
// BREAKING: The `closeOnTriggerHidden` prop was removed because it was unused.
// BREAKING: The `mutationObserverOptions` prop was removed because it was unused.
// BREAKING: The `interactive` prop was removed because it was unused.
// BREAKING: The `strategy` prop was removed because it was unused.
// BREAKING: The `followCursor` prop was removed because it was unused.
// BREAKING: The `closeOnOutsideClick` prop was removed. It is now always enabled. Use a Dialog if you need a popover that does not close automatically.

export interface WithTooltipProps {
  /** Tooltips trigger on hover and focus by default. To trigger on focus only, set this to `true`. */
  triggerOnFocusOnly?: boolean;

  /** Whether to display the tooltip in a prestyled container. True by default. */
  hasChrome?: boolean;

  /** Distance between the trigger and tooltip. Customize only if you have a good reason to. */
  offset?: number;

  /**
   * Placement of the tooltip. Start and End variants involve additional JS dimension calculations
   * and should be used sparingly. Left and Right get inverted in RTL.
   */
  placement?: TooltipDbgProps['placement'];

  /** Tooltip content */
  tooltip: ReactNode;

  /** Tooltip trigger, must be a single child that can receive focus and click/key events. */
  children: ReactElement<DOMAttributes<Element>, string>;

  /** Delay before showing the tooltip, defaults to 200ms. Always instant on focus. */
  delayShow?: number;

  /** Delay before hiding the tooltip, defaults to 400ms. */
  delayHide?: number;

  /** Controlled state: whether the tooltip is visible. */
  visible?: boolean;

  /** Controlled state: fires when user interaction causes the tooltip to change visibility. */
  onVisibleChange?: (isVisible: boolean) => void;
}

const WithTooltip = ({
  triggerOnFocusOnly = false,
  placement,
  hasChrome = true,
  offset = 0,
  tooltip,
  children,
  delayShow = 400,
  delayHide = 200,
  visible,
  onVisibleChange,
  ...props
}: WithTooltipProps) => {
  return (
    <TooltipTrigger
      delay={delayShow}
      closeDelay={delayHide}
      isOpen={visible}
      trigger={triggerOnFocusOnly ? 'focus' : undefined}
      {...props}
    >
      <Focusable>{children}</Focusable>
      <TooltipDbg
        hasChrome={hasChrome}
        offset={offset}
        placement={placement}
        onOpenChange={onVisibleChange}
      >
        {tooltip}
      </TooltipDbg>
    </TooltipTrigger>
  );
};

export {
  WithTooltipPure,
  WithToolTipState,
  WithToolTipState as WithTooltip,
  WithTooltip as WithTooltipDBG,
};
