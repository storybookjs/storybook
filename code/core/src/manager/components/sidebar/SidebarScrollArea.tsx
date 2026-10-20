import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';

/**
 * The element that scrolls the local stories tree and every ref block.
 *
 * A tree reads it to place its sticky rows and its indent lines, and to bring a row into view. The
 * trees do not scroll themselves: one scroll area keeps the blocks in one column, so a ref block
 * can never come to rest below the visible area with no way to reach it.
 */
export const ScrollAreaContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

const Scroller = styled.div(({ theme }) => ({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  // Reserve room under the floating sidebar-bottom widget (its measured height, published as a
  // CSS variable) so the last rows can scroll clear of it. 0 when no widget is mounted.
  paddingBottom: 'var(--sidebar-bottom-height, 0px)',

  // A thin muted thumb on a transparent track, shown while the pointer is over the sidebar or a
  // row inside it holds keyboard focus, and for a grace period after leaving. The component
  // steps the alpha custom property from JS because neither the delayed hide nor the fade can
  // live in CSS: Chromium repaints ::-webkit-scrollbar-* styles when an inline style, attribute
  // or class changes on the element, but never for a transitioned or registered custom property.
  // The color is derived here so Firefox reads the same value through scrollbar-color. That
  // standard property must stay scoped to engines without ::-webkit-scrollbar support: its
  // presence switches the others to native overlay scrollbars that ignore the rules below,
  // appear only while scrolling, and thicken under the pointer.
  '--scrollbar-thumb': `color-mix(in srgb, ${theme.textMutedColor} calc(var(--scrollbar-thumb-alpha, 0) * 100%), transparent)`,
  '@supports not selector(::-webkit-scrollbar)': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--scrollbar-thumb) transparent',
  },
  '&::-webkit-scrollbar': {
    width: 6,
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 6,
    backgroundColor: 'var(--scrollbar-thumb)',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: transparentize(0.2, theme.textMutedColor),
  },
}));

const Frame = styled.div(({ theme }) => ({
  position: 'relative',
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  // The opaque backing of a sticky row, and the colour the fade below resolves to.
  '--sticky-row-background': theme.background.content,
  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--sticky-row-background': theme.background.app,
  },
  // Soft fade at the bottom of the scroll area, easing the cut-off into the rest of the UI.
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    pointerEvents: 'none',
    background: 'linear-gradient(to top, var(--sticky-row-background), transparent)',
  },
}));

const SCROLLBAR_HIDE_DELAY = 200;
// Duration and easing of the shared ScrollArea component's thumb transition (0.2s ease-out).
const SCROLLBAR_FADE_DURATION = 200;
// The shown thumb is the muted text color at half opacity, like the shared ScrollArea thumb.
const SCROLLBAR_THUMB_ALPHA = 0.5;

/** Wraps the tree blocks in the sidebar's one scroll area and shares it with them. */
export function SidebarScrollArea({ children, ...props }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isPointerOver = useRef(false);
  const isFocusWithin = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeFrame = useRef<number | undefined>(undefined);
  const thumbAlpha = useRef(0);

  const fadeThumbTo = useCallback((target: number) => {
    if (fadeFrame.current !== undefined) {
      cancelAnimationFrame(fadeFrame.current);
    }
    const from = thumbAlpha.current;
    if (from === target) {
      return;
    }
    const start = performance.now();
    const step = () => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }
      const progress = Math.min(1, (performance.now() - start) / SCROLLBAR_FADE_DURATION);
      const eased = progress * (2 - progress);
      thumbAlpha.current = from + (target - from) * eased;
      scroller.style.setProperty('--scrollbar-thumb-alpha', String(thumbAlpha.current));
      if (progress < 1) {
        fadeFrame.current = requestAnimationFrame(step);
      }
    };
    step();
  }, []);

  const updateScrollbar = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (isPointerOver.current || isFocusWithin.current) {
      fadeThumbTo(SCROLLBAR_THUMB_ALPHA);
    } else {
      hideTimer.current = setTimeout(() => fadeThumbTo(0), SCROLLBAR_HIDE_DELAY);
    }
  }, [fadeThumbTo]);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      if (fadeFrame.current !== undefined) {
        cancelAnimationFrame(fadeFrame.current);
      }
    },
    []
  );

  return (
    <Frame>
      <Scroller
        ref={scrollerRef}
        data-testid="sidebar-scroll-area"
        onPointerEnter={() => {
          isPointerOver.current = true;
          updateScrollbar();
        }}
        onPointerLeave={() => {
          isPointerOver.current = false;
          updateScrollbar();
        }}
        onFocus={() => {
          isFocusWithin.current = true;
          updateScrollbar();
        }}
        onBlur={(event) => {
          isFocusWithin.current = event.currentTarget.contains(event.relatedTarget);
          updateScrollbar();
        }}
        {...props}
      >
        <ScrollAreaContext.Provider value={scrollerRef}>{children}</ScrollAreaContext.Provider>
      </Scroller>
    </Frame>
  );
}
