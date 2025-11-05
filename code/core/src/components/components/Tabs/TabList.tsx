import type { FC, HTMLAttributes } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { useTab, useTabList } from '@react-aria/tabs';
import type { TabListState } from '@react-stately/tabs';
import type { Node } from '@react-types/shared';
import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
import type { useTabsState } from './TabsView';

const StyledTabButton = styled.button<{
  isDisabled: boolean;
  isPressed: boolean;
  isSelected: boolean;
}>(
  {
    whiteSpace: 'normal',
    display: 'inline-flex',
    overflow: 'hidden',
    verticalAlign: 'top',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    textDecoration: 'none',
    scrollSnapAlign: 'start',

    '&:empty': {
      display: 'none',
    },
    '&[hidden]': {
      display: 'none',
    },
  },
  ({ theme }) => ({
    padding: '0 15px',
    transition: 'color 0.2s linear, border-bottom-color 0.2s linear',
    height: 40,
    lineHeight: '12px',
    cursor: 'pointer',
    background: 'transparent',
    border: '0 solid transparent',
    borderTop: '3px solid transparent',
    borderBottom: '3px solid transparent',
    fontWeight: 'bold',
    fontSize: 13,

    '&:focus-visible': {
      outline: '0 none',
      boxShadow: `inset 0 0 0 2px ${theme.barSelectedColor}`,
    },
  }),
  ({ isSelected, theme }) =>
    isSelected
      ? {
          color: theme.barSelectedColor,
          borderBottomColor: theme.barSelectedColor,
        }
      : {
          color: theme.barTextColor,
          borderBottomColor: 'transparent',
          '&:hover': {
            color: theme.barHoverColor,
          },
        }
);

const TabListContainer = styled.div({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  position: 'relative',
  overflow: 'hidden',
});

const ScrollContainer = styled.div({
  display: 'flex',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  WebkitScrollbar: 'none',
  scrollSnapType: 'x mandatory',
  flex: 1,

  '&::-webkit-scrollbar': {
    display: 'none',
  },
});

const StyledTabList = styled.div({
  display: 'flex',
  flexShrink: 0,
});

const SCROLL_BUTTON_WIDTH = 28; // 16 width + 6 + 6 padding

const ScrollButtonContainer = styled.div<{
  $showStartBorder?: boolean;
  $showEndBorder?: boolean;
}>(({ $showStartBorder, $showEndBorder, theme }) => ({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  boxShadow: $showStartBorder
    ? `inset 1px 0 0 ${theme.appBorderColor}`
    : $showEndBorder
      ? `inset -1px 0 0 ${theme.appBorderColor}`
      : 'none',
}));

const ScrollButton = styled(Button)({
  flexShrink: 0,
  paddingInline: 0,
  width: 16,
});

interface TabButtonProps {
  item: Node<object>;
  state: ReturnType<typeof useTabsState>;
}

const TabButton: FC<TabButtonProps> = ({ item, state }) => {
  const { key, rendered } = item;
  const tabRef = React.useRef(null);
  const typedState = state as TabListState<object>;
  const { tabProps, isDisabled, isPressed, isSelected } = useTab({ key }, typedState, tabRef);

  return (
    <StyledTabButton
      {...tabProps}
      isDisabled={isDisabled}
      isPressed={isPressed}
      isSelected={isSelected}
      className={`tabbutton ${isSelected ? 'tabbutton-active' : ''}`}
      ref={tabRef}
    >
      {rendered}
    </StyledTabButton>
  );
};

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  state: ReturnType<typeof useTabsState>;
}

export const TabList: FC<TabListProps> = ({ state, ...rest }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList(
    { orientation: 'horizontal' },
    state as TabListState<object>,
    tabListRef
  );

  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const container = containerRef.current;

    if (!scrollContainer || !container) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    const availableWidth =
      container.clientWidth - (showScrollButtons ? SCROLL_BUTTON_WIDTH * 2 : 0);

    const needsScrolling = scrollWidth > availableWidth;
    setShowScrollButtons(needsScrolling);

    if (needsScrolling) {
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    } else {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    }
  }, [showScrollButtons]);

  const throttledUpdateScrollState = useCallback(() => {
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || typeof window === 'undefined') {
      return;
    }

    scrollContainer.addEventListener('scroll', throttledUpdateScrollState, { passive: true });

    // SSR safety: ResizeObserver may not exist in all environments
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(throttledUpdateScrollState);
      resizeObserver.observe(scrollContainer);
    }

    // Initial update - delay to ensure DOM is ready
    const timeoutId = setTimeout(throttledUpdateScrollState, 0);

    return () => {
      clearTimeout(timeoutId);
      scrollContainer.removeEventListener('scroll', throttledUpdateScrollState);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [throttledUpdateScrollState]);

  const scroll = useCallback((direction: 'backward' | 'forward') => {
    const scrollContainer = scrollContainerRef.current;
    const container = containerRef.current;

    if (!scrollContainer || !container || typeof window === 'undefined') {
      return;
    }

    const availableWidth = container.clientWidth - SCROLL_BUTTON_WIDTH * 2;
    const scrollDistance = direction === 'backward' ? -availableWidth : availableWidth;

    // SSR safety: scrollBy may not exist in all environments
    if (typeof scrollContainer.scrollBy === 'function') {
      scrollContainer.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    } else {
      // Fallback for older browsers or SSR
      scrollContainer.scrollLeft += scrollDistance;
    }
  }, []);

  const scrollBackward = useCallback(() => scroll('backward'), [scroll]);
  const scrollForward = useCallback(() => scroll('forward'), [scroll]);

  return (
    <TabListContainer {...rest} ref={containerRef} data-show-scroll-buttons={showScrollButtons}>
      {showScrollButtons && (
        <ScrollButtonContainer $showEndBorder={canScrollLeft}>
          <ScrollButton
            variant="ghost"
            padding="small"
            size="small"
            ariaLabel="Scroll backward"
            disabled={!canScrollLeft}
            onClick={scrollBackward}
            tabIndex={-1}
          >
            <ChevronSmallLeftIcon />
          </ScrollButton>
        </ScrollButtonContainer>
      )}
      <ScrollContainer ref={scrollContainerRef}>
        <StyledTabList ref={tabListRef} {...tabListProps}>
          {[...(state as TabListState<object>).collection].map((item) => (
            <TabButton key={item.key} item={item} state={state} />
          ))}
        </StyledTabList>
      </ScrollContainer>
      {showScrollButtons && (
        <ScrollButtonContainer $showStartBorder={canScrollRight}>
          <ScrollButton
            variant="ghost"
            padding="small"
            size="small"
            ariaLabel="Scroll forward"
            disabled={!canScrollRight}
            onClick={scrollForward}
            tabIndex={-1}
          >
            <ChevronSmallRightIcon />
          </ScrollButton>
        </ScrollButtonContainer>
      )}
    </TabListContainer>
  );
};
