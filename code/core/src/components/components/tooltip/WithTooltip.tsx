import type { ComponentProps, FC, ReactNode } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { deprecate } from 'storybook/internal/client-logger';

import { global } from '@storybook/global';

import memoize from 'memoizerific';
import type { PopperOptions, Config as ReactPopperTooltipConfig } from 'react-popper-tooltip';
import { usePopperTooltip } from 'react-popper-tooltip';
import { type Color, lighten, styled } from 'storybook/theming';

const { document } = global;

const match = memoize(1000)((requests, actual, value, fallback = 0) =>
  actual.split('-')[0] === requests ? value : fallback
);

const ArrowSpacing = 8;

export interface ArrowProps {
  color: keyof Color;
  placement: string;
}

const Arrow = styled.div<ArrowProps>(
  {
    position: 'absolute',
    borderStyle: 'solid',
  },
  ({ placement }) => {
    let x = 0;
    let y = 0;

    switch (true) {
      case placement.startsWith('left') || placement.startsWith('right'): {
        y = 8;
        break;
      }
      case placement.startsWith('top') || placement.startsWith('bottom'): {
        x = 8;
        break;
      }
      default: {
        //
      }
    }

    const transform = `translate3d(${x}px, ${y}px, 0px)`;
    return { transform };
  },
  ({ theme, color, placement }) => ({
    bottom: `${match('top', placement, `${ArrowSpacing * -1}px`, 'auto')}`,
    top: `${match('bottom', placement, `${ArrowSpacing * -1}px`, 'auto')}`,
    right: `${match('left', placement, `${ArrowSpacing * -1}px`, 'auto')}`,
    left: `${match('right', placement, `${ArrowSpacing * -1}px`, 'auto')}`,

    borderBottomWidth: `${match('top', placement, '0', ArrowSpacing)}px`,
    borderTopWidth: `${match('bottom', placement, '0', ArrowSpacing)}px`,
    borderRightWidth: `${match('left', placement, '0', ArrowSpacing)}px`,
    borderLeftWidth: `${match('right', placement, '0', ArrowSpacing)}px`,

    borderTopColor: match(
      'top',
      placement,
      theme.color[color] || color || theme.base === 'light'
        ? lighten(theme.background.app)
        : theme.background.app,
      'transparent'
    ),
    borderBottomColor: match(
      'bottom',
      placement,
      theme.color[color] || color || theme.base === 'light'
        ? lighten(theme.background.app)
        : theme.background.app,
      'transparent'
    ),
    borderLeftColor: match(
      'left',
      placement,
      theme.color[color] || color || theme.base === 'light'
        ? lighten(theme.background.app)
        : theme.background.app,
      'transparent'
    ),
    borderRightColor: match(
      'right',
      placement,
      theme.color[color] || color || theme.base === 'light'
        ? lighten(theme.background.app)
        : theme.background.app,
      'transparent'
    ),
  })
);

export interface WrapperProps {
  color: keyof Color | undefined;
  hidden?: boolean;
  hasChrome: boolean;
}

const Wrapper = styled.div<WrapperProps>(
  ({ hidden }) => ({
    display: hidden ? 'none' : 'inline-block',
    zIndex: 2147483647,
    colorScheme: 'light dark',
  }),
  ({ theme, color, hasChrome }) =>
    hasChrome
      ? {
          background:
            (color && theme.color[color]) || color || theme.base === 'light'
              ? lighten(theme.background.app)
              : theme.background.app,
          filter: `
            drop-shadow(0px 5px 5px rgba(0,0,0,0.05))
            drop-shadow(0 1px 3px rgba(0,0,0,0.1))
          `,
          borderRadius: theme.appBorderRadius + 2,
          fontSize: theme.typography.size.s1,
        }
      : {}
);

export interface TooltipProps {
  children?: React.ReactNode;
  tooltipRef?: any;
  hasChrome?: boolean;
  arrowProps?: any;
  placement?: string;
  color?: keyof Color;
  withArrows?: boolean;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      placement = 'top',
      hasChrome = true,
      children,
      arrowProps = {},
      tooltipRef,
      color,
      withArrows,
      ...props
    },
    ref
  ) => {
    return (
      <Wrapper data-testid="tooltip" hasChrome={hasChrome} ref={ref} {...props} color={color}>
        {hasChrome && withArrows && <Arrow placement={placement} {...arrowProps} color={color} />}
        {children}
      </Wrapper>
    );
  }
);

Tooltip.displayName = 'Tooltip';

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
  extends
    Omit<ReactPopperTooltipConfig, 'closeOnOutsideClick'>,
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
  hasChrome = true,
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
    <Tooltip
      placement={state?.placement}
      ref={setTooltipRef}
      hasChrome={hasChrome}
      arrowProps={getArrowProps()}
      withArrows={withArrows}
      {...getTooltipProps()}
    >
      {/* @ts-expect-error (non strict) */}
      {typeof tooltip === 'function' ? tooltip({ onHide: () => onVisibleChange(false) }) : tooltip}
    </Tooltip>
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide();
      }
    };
    document.addEventListener('keydown', handleKeyDown, false);

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
      document.removeEventListener('keydown', handleKeyDown);
      unbinders.forEach((unbind) => {
        unbind();
      });
    };
  });

  return <WithTooltipPure {...rest} visible={tooltipShown} onVisibleChange={onVisibilityChange} />;
};

const DeprecatedPure: FC<WithTooltipPureProps> = (props: WithTooltipPureProps) => {
  deprecate(
    'WithTooltipPure is deprecated and will be removed in Storybook 11. Please use WithTooltip instead.'
  );
  return <WithTooltipPure data-deprecated="WithTooltipPure" {...props} />;
};

const DeprecatedState: FC<WithTooltipStateProps> = (props: WithTooltipStateProps) => {
  deprecate(
    'WithToolTipState is deprecated and will be removed in Storybook 11. Please use WithTooltip instead.'
  );
  return <WithToolTipState data-deprecated="WithToolTipState" {...props} />;
};

export {
  DeprecatedPure as WithTooltipPure,
  DeprecatedState as WithToolTipState,
  WithToolTipState as WithTooltip,
};
