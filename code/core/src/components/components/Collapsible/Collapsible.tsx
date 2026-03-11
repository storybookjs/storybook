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
    initialCollapsed,
    storageKey,
    state: providedState,
    ...props
  }: {
    children: ReactNode | ((state: ReturnType<typeof useCollapsible>) => ReactNode);
    summary?: ReactNode | ((state: ReturnType<typeof useCollapsible>) => ReactNode);
    collapsed?: boolean;
    disabled?: boolean;
    initialCollapsed?: boolean;
    storageKey?: string;
    state?: ReturnType<typeof useCollapsible>;
  } & ComponentProps<typeof CollapsibleContent>) {
    const internalState = useCollapsible({ collapsed, disabled, initialCollapsed, storageKey });
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

const useSessionState = <T,>(key: string | undefined, initialValue: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      return (JSON.parse(sessionStorage.getItem(key!)!) as T) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (key) {
        sessionStorage.setItem(key, JSON.stringify(value));
      }
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
};

export const useCollapsible = ({
  collapsed,
  disabled,
  initialCollapsed = collapsed,
  storageKey,
}: {
  collapsed?: boolean;
  disabled?: boolean;
  initialCollapsed?: boolean;
  storageKey?: string;
}) => {
  const [isCollapsed, setCollapsed] = useSessionState(
    storageKey && `useCollapsible:${storageKey}`,
    !!initialCollapsed
  );

  useEffect(() => {
    if (collapsed !== undefined) {
      setCollapsed(collapsed);
    }
  }, [collapsed, setCollapsed]);

  const toggleCollapsed = useCallback(
    (event?: SyntheticEvent<Element, Event>) => {
      event?.stopPropagation();
      if (!disabled) {
        setCollapsed((value) => !value);
      }
    },
    [disabled, setCollapsed]
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
