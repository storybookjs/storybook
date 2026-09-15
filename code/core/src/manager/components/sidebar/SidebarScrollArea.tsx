import React, { createContext, useRef, type ReactNode, type RefObject } from 'react';

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

  // A thin muted thumb on a transparent track, visible only while the pointer is over the sidebar
  // or a row inside it holds keyboard focus.
  scrollbarWidth: 'thin',
  scrollbarColor: 'transparent transparent',
  '&::-webkit-scrollbar': {
    width: 6,
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  '&:hover, &:focus-within': {
    scrollbarColor: `${transparentize(0.5, theme.textMutedColor)} transparent`,
  },
  '&:hover::-webkit-scrollbar-thumb, &:focus-within::-webkit-scrollbar-thumb': {
    backgroundColor: transparentize(0.5, theme.textMutedColor),
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

/** Wraps the tree blocks in the sidebar's one scroll area and shares it with them. */
export function SidebarScrollArea({ children, ...props }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  return (
    <Frame>
      <Scroller ref={scrollerRef} data-testid="sidebar-scroll-area" {...props}>
        <ScrollAreaContext.Provider value={scrollerRef}>{children}</ScrollAreaContext.Provider>
      </Scroller>
    </Frame>
  );
}
