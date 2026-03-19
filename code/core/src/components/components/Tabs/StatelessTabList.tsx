import type { FC, ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { TabList as TabListUpstream } from 'react-aria-components/patched-dist/Tabs';
import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';

const Root = styled.div({
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

const StyledTabList = styled(TabListUpstream)({
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

export interface StatelessTabListProps {
  children?: ReactNode;
}

export const StatelessTabList: FC<StatelessTabListProps> = ({ children, ...rest }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToSelected = useRef(false);

  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const showScrollButtonsRef = useRef(false);
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
      container.clientWidth - (showScrollButtonsRef.current ? SCROLL_BUTTON_WIDTH * 2 : 0);

    const needsScrolling = scrollWidth > availableWidth;
    showScrollButtonsRef.current = needsScrolling;
    setShowScrollButtons(needsScrolling);

    if (needsScrolling) {
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    } else {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || typeof window === 'undefined') {
      return;
    }

    scrollContainer.addEventListener('scroll', updateScrollState, { passive: true });

    // SSR safety: ResizeObserver may not exist in all environments
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(scrollContainer);
    }

    // Initial update - delay to ensure DOM is ready
    const timeoutId = setTimeout(updateScrollState, 0);

    return () => {
      clearTimeout(timeoutId);
      scrollContainer.removeEventListener('scroll', updateScrollState);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updateScrollState]);

  const scrollTabIntoView = useCallback((tab: HTMLElement) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    if (tabRect.left < containerRect.left) {
      scrollContainer.scrollLeft -= containerRect.left - tabRect.left;
    } else if (tabRect.right > containerRect.right) {
      scrollContainer.scrollLeft += tabRect.right - containerRect.right;
    }
  }, []);

  // Auto-scroll focused tab into view when navigating with arrow keys
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || typeof window === 'undefined') {
      return;
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('role') === 'tab') {
        scrollTabIntoView(target);
      }
    };

    scrollContainer.addEventListener('focusin', handleFocusIn);
    return () => scrollContainer.removeEventListener('focusin', handleFocusIn);
  }, [scrollTabIntoView]);

  // Scroll the selected tab into view on initial render
  useEffect(() => {
    if (hasScrolledToSelected.current) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || typeof window === 'undefined') {
      return;
    }

    const timeoutId = setTimeout(() => {
      const selectedTab = scrollContainer.querySelector('[data-selected]') as HTMLElement | null;
      if (selectedTab) {
        scrollTabIntoView(selectedTab);
        updateScrollState();
      }
      hasScrolledToSelected.current = true;
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [scrollTabIntoView, updateScrollState]);

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
    <Root ref={containerRef} className={`tablist ${showScrollButtons ? 'tablist-has-scroll' : ''}`}>
      {showScrollButtons && (
        <ScrollButtonContainer $showEndBorder={canScrollLeft}>
          <ScrollButton
            variant="ghost"
            padding="small"
            size="small"
            ariaLabel="Scroll backward"
            disabled={!canScrollLeft}
            onClick={scrollBackward}
          >
            <ChevronSmallLeftIcon />
          </ScrollButton>
        </ScrollButtonContainer>
      )}
      <ScrollContainer ref={scrollContainerRef}>
        <StyledTabList {...rest}>{children}</StyledTabList>
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
          >
            <ChevronSmallRightIcon />
          </ScrollButton>
        </ScrollButtonContainer>
      )}
    </Root>
  );
};
