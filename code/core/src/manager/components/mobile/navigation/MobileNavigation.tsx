import type { ComponentProps, FC } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from 'storybook/internal/components';
import type { API_IndexHash, API_Refs } from 'storybook/internal/types';

import { BottomBarToggleIcon, MenuIcon } from '@storybook/icons';

import { useId } from '@react-aria/utils';
import { type API_KeyCollection, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLandmark } from '../../../hooks/useLandmark.ts';
import { useLayout } from '../../layout/LayoutProvider.tsx';
import { MobileAddonsDrawer } from './MobileAddonsDrawer.tsx';
import { MobileMenuDrawer } from './MobileMenuDrawer.tsx';

interface MobileNavigationProps {
  menu?: React.ReactNode;
  panel?: React.ReactNode;
  showMenu?: boolean;
  showPanel: boolean;
}

// Function to combine all indexes
function combineIndexes(rootIndex: API_IndexHash | undefined, refs: API_Refs) {
  // Create a copy of the root index to avoid mutation
  const combinedIndex = { ...(rootIndex || {}) }; // Use an empty object as fallback

  // Traverse refs and merge each nested index with the root index
  Object.values(refs).forEach((ref) => {
    if (ref.index) {
      Object.assign(combinedIndex, ref.index);
    }
  });

  return combinedIndex;
}

/**
 * Walks the tree from the current story to combine story+component+folder names into a single
 * string
 */
const useFullStoryName = () => {
  const { index, refs } = useStorybookState();
  const api = useStorybookApi();
  const currentStory = api.getCurrentStoryData();

  if (!currentStory) {
    return '';
  }
  const combinedIndex = combineIndexes(index, refs || {});
  const storyLabel = currentStory.renderLabel?.(currentStory, api);
  let fullStoryName = typeof storyLabel === 'string' ? storyLabel : currentStory.name;

  let node = combinedIndex[currentStory.id];

  while (
    node &&
    'parent' in node &&
    node.parent &&
    combinedIndex[node.parent] &&
    fullStoryName.length < 24
  ) {
    node = combinedIndex[node.parent];
    const parentLabel = node.renderLabel?.(node, api);
    const parentName = typeof parentLabel === 'string' ? parentLabel : node.name;
    fullStoryName = `${parentName}/${fullStoryName}`;
  }
  return fullStoryName;
};

interface MobileBottomBarContentProps {
  fullStoryName: string;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (isOpen: boolean) => void;
  isMobilePanelOpen: boolean;
  setMobilePanelOpen: (isOpen: boolean) => void;
  showMenu: boolean;
  showPanel: boolean;
  navShortcut?: API_KeyCollection;
}

/**
 * The mobile bottom bar is split into its own component so that `useLandmark` is only invoked while
 * the underlying DOM element is mounted. Calling `useLandmark` unconditionally from a parent that
 * conditionally renders the bar leaves a stale landmark with a null `ref.current` in
 * `@react-aria/landmark`'s manager, which crashes the binary-search position comparison the next
 * time another landmark is registered.
 */
const MobileBottomBarContent: FC<MobileBottomBarContentProps> = ({
  fullStoryName,
  isMobileMenuOpen,
  setMobileMenuOpen,
  isMobilePanelOpen,
  setMobilePanelOpen,
  showMenu,
  showPanel,
  navShortcut,
}) => {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { 'aria-labelledby': headingId, role: 'banner' },
    sectionRef
  );

  return (
    <MobileBottomBar className="sb-bar" {...landmarkProps} ref={sectionRef}>
      <h2 id={headingId} className="sb-sr-only">
        Navigation controls
      </h2>
      {showMenu && (
        <BottomBarButton
          padding="small"
          variant="ghost"
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          ariaLabel="Open navigation menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls={isMobileMenuOpen ? 'storybook-mobile-menu' : undefined}
          shortcut={navShortcut}
        >
          <MenuIcon />
          <Text>{fullStoryName}</Text>
        </BottomBarButton>
      )}
      <span className="sb-sr-only" aria-current="page">
        {fullStoryName}
      </span>
      {showPanel && (
        <BottomBarButton
          padding="small"
          variant="ghost"
          onClick={() => setMobilePanelOpen(true)}
          ariaLabel="Open addon panel"
          aria-expanded={isMobilePanelOpen}
          aria-controls={isMobilePanelOpen ? 'storybook-mobile-addon-panel' : undefined}
        >
          <BottomBarToggleIcon />
        </BottomBarButton>
      )}
    </MobileBottomBar>
  );
};

export const MobileNavigation: FC<MobileNavigationProps & ComponentProps<typeof Container>> = ({
  menu,
  panel,
  showMenu = true,
  showPanel,
  ...props
}) => {
  const { isMobilePanelOpen, setMobilePanelOpen } = useLayout();
  const fullStoryName = useFullStoryName();
  const api = useStorybookApi();
  // The drawer's open state is the manager-api layout field, the single source of truth. On mobile
  // `api.toggleNav()` flips this field, so the sidebar keyboard shortcut opens the drawer too.
  const { layout, ui } = useStorybookState();
  const isMobileMenuOpen = layout.showMobileNavigation;
  // Stable identity: the `showMenu` effect below lists this in its deps.
  const setMobileMenuOpen = useCallback((open: boolean) => api.setMobileNavigation(open), [api]);

  // Reset the drawer state when the mobile nav leaves the tree (e.g. resizing to desktop), so a
  // drawer left open on mobile does not linger as stale store state. Read `api` through a ref so the
  // reset only runs on unmount, not whenever the api identity changes.
  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => () => apiRef.current.setMobileNavigation(false), []);

  // Read `enableShortcuts` from the store, the same source the shortcut handler checks, so the
  // button never advertises a shortcut the handler would ignore.
  const enableShortcuts = ui.enableShortcuts ?? true;
  const navShortcut = enableShortcuts ? api.getShortcutKeys().toggleNav : undefined;

  useLayoutEffect(() => {
    if (!showMenu) {
      setMobileMenuOpen(false);
    }
  }, [showMenu, setMobileMenuOpen]);

  return (
    <Container {...props}>
      {showMenu && (
        <MobileMenuDrawer
          id="storybook-mobile-menu"
          isOpen={isMobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        >
          {menu}
        </MobileMenuDrawer>
      )}

      <MobileAddonsDrawer
        id="storybook-mobile-addon-panel"
        isOpen={isMobilePanelOpen}
        onOpenChange={setMobilePanelOpen}
      >
        {panel}
      </MobileAddonsDrawer>

      {!isMobilePanelOpen && (showMenu || showPanel) && (
        <MobileBottomBarContent
          fullStoryName={fullStoryName}
          isMobileMenuOpen={isMobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isMobilePanelOpen={isMobilePanelOpen}
          setMobilePanelOpen={setMobilePanelOpen}
          showMenu={showMenu}
          showPanel={showPanel}
          navShortcut={navShortcut}
        />
      )}
    </Container>
  );
};

const Container = styled.section(({ theme }) => ({
  bottom: 0,
  left: 0,
  width: '100%',
  zIndex: 10,
  background: theme.barBg,
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const MobileBottomBar = styled.header({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: 40,
  padding: '0 6px',

  /* Because Popper.js's tooltip is creating extra div layers, we have to
   * punch through them to configure the button to ellipsize. */
  '& > *:first-child': {
    /* 6px padding * 2 + 28px for the orientation button */
    maxWidth: 'calc(100% - 40px)',
    '& > button': {
      maxWidth: '100%',
    },
    '& > button p': {
      textOverflow: 'ellipsis',
    },
  },
});

const BottomBarButton = styled(Button)({
  WebkitLineClamp: 1,
  flexShrink: 1,
  p: {
    textOverflow: 'ellipsis',
  },
});

const Text = styled.p({
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});
