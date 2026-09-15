import type { ComponentProps, FC } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { Button } from 'storybook/internal/components';
import type { API_IndexHash, API_Refs } from 'storybook/internal/types';

import { BottomBarToggleIcon, MenuIcon } from '@storybook/icons';

import { useId } from 'react-aria/useId';
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
 * Walk the tree from the current story up to the root. Join the story, component and folder names
 * into a visible name and an accessible name.
 */
const useFullStoryName = () => {
  const { index, refs } = useStorybookState();
  const api = useStorybookApi();
  const currentStory = api.getCurrentStoryData();

  // A merge of every ref index allocates an object as large as the whole sidebar. Rebuild it
  // only when the indexes change.
  const combinedIndex = useMemo(() => combineIndexes(index, refs || {}), [index, refs]);

  if (!currentStory) {
    return { fullStoryAriaLabel: '', fullStoryName: '' };
  }
  // renderLabel and renderAriaLabel can return any ReactNode. The bottom bar joins names into
  // plain strings, so a value that is not a string falls back to the entry name. The fallback
  // keeps the string "[object Object]" out of the label.
  const labelContext = { isMobile: true, location: 'bottom-bar' } as const;
  const storyLabel = currentStory.renderLabel?.(currentStory, api, labelContext);
  let fullStoryName = typeof storyLabel === 'string' ? storyLabel : currentStory.name;
  const storyAriaLabel = currentStory.renderAriaLabel?.(currentStory, api, labelContext);
  let fullStoryAriaLabel = typeof storyAriaLabel === 'string' ? storyAriaLabel : fullStoryName;

  let node = combinedIndex[currentStory.id];

  while (node && 'parent' in node && node.parent && combinedIndex[node.parent]) {
    node = combinedIndex[node.parent];
    const parentLabel = node.renderLabel?.(node, api, labelContext);
    const parentName = typeof parentLabel === 'string' ? parentLabel : node.name;
    const parentAriaOutput = node.renderAriaLabel?.(node, api, labelContext);
    const parentAriaLabel = typeof parentAriaOutput === 'string' ? parentAriaOutput : parentName;

    // The visible name must stay short, because the bottom bar has little space.
    if (fullStoryName.length < 24) {
      fullStoryName = `${parentName}/${fullStoryName}`;
    }
    fullStoryAriaLabel = `${parentAriaLabel}/${fullStoryAriaLabel}`;
  }
  return { fullStoryAriaLabel, fullStoryName };
};

interface MobileBottomBarContentProps {
  fullStoryAriaLabel: string;
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
 * The mobile bottom bar is a separate component so that `useLandmark` runs only while the bar
 * element is mounted. A call to `useLandmark` from a parent that renders the bar conditionally
 * leaves a stale landmark with a null `ref.current` in the react-aria landmark manager. That stale
 * landmark then crashes the binary search for the landmark position when the next landmark
 * registers.
 */
const MobileBottomBarContent: FC<MobileBottomBarContentProps> = ({
  fullStoryAriaLabel,
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
        Current page: {fullStoryAriaLabel}
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
  const { fullStoryAriaLabel, fullStoryName } = useFullStoryName();
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
          fullStoryAriaLabel={fullStoryAriaLabel}
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
