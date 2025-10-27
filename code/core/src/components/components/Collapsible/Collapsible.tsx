import React, {
  type ComponentProps,
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
}: {
  children: React.ReactNode | ((state: ReturnType<typeof useCollapsible>) => React.ReactNode);
  summary?: React.ReactNode | ((state: ReturnType<typeof useCollapsible>) => React.ReactNode);
  collapsed?: boolean;
}) => {
  const state = useCollapsible(collapsed);

  return (
    <>
      {typeof summary === 'function' ? summary(state) : summary}
      <CollapsibleContent
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

const Content = styled.div<{ collapsed: boolean }>(({ collapsed }) => ({
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

export const useCollapsible = (collapsed?: boolean) => {
  const [isCollapsed, setCollapsed] = useState(!!collapsed);

  useEffect(() => {
    if (collapsed !== undefined) {
      setCollapsed(collapsed);
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback((event?: SyntheticEvent<Element, Event>) => {
    event?.stopPropagation();
    setCollapsed((value) => !value);
  }, []);

  const contentId = useId();
  const toggleProps = {
    onClick: toggleCollapsed,
    'aria-controls': contentId,
    'aria-expanded': !isCollapsed,
  } as const;

  return { contentId, isCollapsed, setCollapsed, toggleCollapsed, toggleProps };
};
