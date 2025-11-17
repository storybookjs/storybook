import React, {
  type ComponentProps,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from 'react';

import { styled } from 'storybook/theming';

export const Collapsible = ({
  children,
  summary,
  collapsed,
  disabled,
  state: providedState,
  ...props
}: {
  children: ReactNode | ((state: ReturnType<typeof useCollapsible>) => ReactNode);
  summary?: ReactNode | ((state: ReturnType<typeof useCollapsible>) => ReactNode);
  collapsed?: boolean;
  disabled?: boolean;
  state?: ReturnType<typeof useCollapsible>;
} & ComponentProps<typeof CollapsibleContent>) => {
  const internalState = useCollapsible(collapsed, disabled);
  const state = providedState || internalState;
  return (
    <>
      {typeof summary === 'function' ? summary(state) : summary}
      <CollapsibleContent
        {...props}
        id={state.contentId}
        collapsed={state.isCollapsed}
        aria-hidden={state.isCollapsed}
      >
        {typeof children === 'function' ? children(state) : children}
      </CollapsibleContent>
    </>
  );
};

export const CollapsibleContent = ({ collapsed, ...props }: ComponentProps<typeof Content>) => (
  <Content collapsed={collapsed} aria-hidden={collapsed} {...props} />
);

const Content = styled.div<{ collapsed?: boolean }>(({ collapsed = false }) => ({
  blockSize: collapsed ? 0 : 'auto',
  interpolateSize: 'allow-keywords',
  contentVisibility: collapsed ? 'hidden' : 'visible',
  transform: collapsed ? 'translateY(-10px)' : 'translateY(0)',
  opacity: collapsed ? 0 : 1,
  overflow: 'hidden',
  transition: 'all var(--transition-duration, 0.2s)',
  transitionBehavior: 'allow-discrete',

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

export const useCollapsible = (collapsed?: boolean, disabled?: boolean) => {
  const [isCollapsed, setCollapsed] = useState(!!collapsed);

  useEffect(() => {
    if (collapsed !== undefined) {
      setCollapsed(collapsed);
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(
    (event?: SyntheticEvent<Element, Event>) => {
      event?.stopPropagation();
      if (!disabled) {
        setCollapsed((value) => !value);
      }
    },
    [disabled]
  );

  const contentId = useId();
  const toggleProps = {
    disabled,
    onClick: toggleCollapsed,
    'aria-controls': contentId,
    'aria-expanded': !isCollapsed,
  } as const;

  return {
    contentId,
    isCollapsed,
    isDisabled: !!disabled,
    setCollapsed,
    toggleCollapsed,
    toggleProps,
  };
};
