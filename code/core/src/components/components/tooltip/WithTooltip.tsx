import type { ComponentProps, ReactNode } from 'react';
import React, { useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';

import { global } from '@storybook/global';

import { useOverlay, useOverlayPosition } from '@react-aria/overlays';
import { useTooltipTrigger } from '@react-aria/tooltip';
import { useTooltip } from '@react-aria/tooltip';
import { useTooltipTriggerState } from '@react-stately/tooltip';
import { styled } from 'storybook/theming';

import { Tooltip } from './Tooltip';

const { document } = global;

type TriggerOption = 'click' | 'hover';
type TriggerConfig = TriggerOption | TriggerOption[];

// A target that doesn't speak popper
const TargetContainer = styled.div<{ trigger: TriggerConfig }>`
  display: inline-block;
  cursor: ${(props) =>
    props.trigger === 'hover' || props.trigger?.includes('hover') ? 'default' : 'pointer'};
`;

const TargetSvgContainer = styled.g<{ trigger: TriggerConfig }>`
  cursor: ${(props) =>
    props.trigger === 'hover' || props.trigger?.includes('hover') ? 'default' : 'pointer'};
`;

interface WithHideFn {
  onHide: () => void;
}

export interface WithTooltipPureProps
  extends Omit<ComponentProps<typeof TargetContainer>, 'trigger'> {
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
  trigger?: TriggerConfig;
  placement?: any;
  offset?: number;
  defaultVisible?: boolean;
  delayHide?: number;
  delayShow?: number;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void | boolean;
}

// Pure, does not bind to the body
const WithTooltipPure = ({
  svg = false,
  trigger = 'click',
  closeOnOutsideClick = false,
  placement = 'top',
  hasChrome = true,
  defaultVisible = false,
  withArrows,
  offset,
  tooltip,
  children,
  delayHide = trigger === 'hover' ? 200 : 0,
  visible,
  delayShow = trigger === 'hover' ? 400 : 0,
  onVisibleChange = () => {},
  ...props
}: WithTooltipPureProps) => {
  const Container = svg ? TargetSvgContainer : TargetContainer;
  const triggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);

  const triggerIncludesHover = useMemo(() => {
    if (!trigger) {
      return false;
    }

    if (typeof trigger === 'string') {
      return trigger === 'hover';
    }
    return Array.isArray(trigger) && trigger.includes('hover');
  }, [trigger]);

  const containerProps = props as any;
  const {
    onFocus: userOnFocus,
    onBlur: userOnBlur,
    ...restContainerProps
  } = (containerProps || {}) as {
    onFocus?: (e: React.FocusEvent<any>) => void;
    onBlur?: (e: React.FocusEvent<any>) => void;
  } & Record<string, unknown>;

  // State management via React Aria/Stately
  const tooltipState = useTooltipTriggerState({
    isOpen: visible ?? undefined,
    defaultOpen: defaultVisible,
    onOpenChange: (open: boolean) => {
      onVisibleChange(open);
    },
    delay: triggerIncludesHover ? delayShow : 0,
  });

  const isVisible = visible ?? tooltipState.isOpen;

  const { triggerProps: hoverTriggerProps } = triggerIncludesHover
    ? useTooltipTrigger({}, tooltipState, triggerRef as any)
    : { triggerProps: {} };

  const { tooltipProps: ariaTooltipProps } = useTooltip({}, tooltipState);

  const { overlayProps } = useOverlay(
    {
      isOpen: isVisible,
      isDismissable: closeOnOutsideClick,
      shouldCloseOnBlur: false,
      onClose: () => onVisibleChange(false),
    },
    overlayRef
  );

  const {
    overlayProps: positionProps,
    placement: actualPlacement,
    arrowProps,
  } = useOverlayPosition({
    targetRef: triggerRef as any,
    overlayRef: overlayRef as any,
    placement,
    offset,
    isOpen: isVisible,
    shouldFlip: true,
  });

  const tooltipComponent = isVisible ? (
    <Tooltip
      placement={actualPlacement}
      ref={overlayRef as any}
      hasChrome={hasChrome}
      arrowProps={arrowProps as any}
      withArrows={withArrows}
      {...(overlayProps as any)}
      {...(positionProps as any)}
      {...(ariaTooltipProps as any)}
    >
      {typeof tooltip === 'function' ? tooltip({ onHide: () => onVisibleChange(false) }) : tooltip}
    </Tooltip>
  ) : null;

  return (
    <>
      <Container
        trigger={trigger}
        ref={triggerRef as any}
        onFocus={(e: React.FocusEvent<any>) => {
          if (typeof userOnFocus === 'function') {
            userOnFocus(e);
          }
        }}
        onBlur={(e: React.FocusEvent<any>) => {
          if (typeof userOnBlur === 'function') {
            userOnBlur(e);
          }
        }}
        onClick={
          !triggerIncludesHover
            ? () => {
                onVisibleChange(!isVisible);
              }
            : undefined
        }
        {...(hoverTriggerProps as any)}
        {...(restContainerProps as any)}
      >
        {children}
      </Container>
      {isVisible && ReactDOM.createPortal(tooltipComponent, document.body)}
    </>
  );
};

export { WithTooltipPure, WithTooltipPure as WithTooltip };
