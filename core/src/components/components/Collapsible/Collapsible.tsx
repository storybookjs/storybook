import React, {
  type ComponentProps,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useId } from '@react-aria/utils';
import { styled } from 'storybook/theming';

const CollapsibleContent = styled.div<{ collapsed?: boolean }>(({ collapsed = false }) => ({
  blockSize: collapsed ? 0 : 'auto',
  contentVisibility: collapsed ? 'hidden' : 'visible',
  transform: collapsed ? 'translateY(-10px)' : 'translateY(0)',
  opacity: collapsed ? 0 : 1,
  overflow: 'hidden',

  '@supports (interpolate-size: allow-keywords)': {
    interpolateSize: 'allow-keywords',
    transition: 'all var(--transition-duration, 0.2s)',
    transitionBehavior: 'allow-discrete',
  },

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

export const Collapsible = Object.assign(
  function Collapsible({
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
  } & ComponentProps<typeof CollapsibleContent>) {
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
  },
  {
    Content: CollapsibleContent,
  }
);

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
