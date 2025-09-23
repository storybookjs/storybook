import type { ComponentProps, FC } from 'react';
import React from 'react';

import { IconButton } from 'storybook/internal/components';
import type { API_IndexHash, API_Refs } from 'storybook/internal/types';

import { BottomBarToggleIcon, MenuIcon } from '@storybook/icons';

import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLayout } from '../../layout/LayoutProvider';
import { MobileAddonsDrawer } from './MobileAddonsDrawer';
import { MobileMenuDrawer } from './MobileMenuDrawer';

interface MobileNavigationProps {
  menu?: React.ReactNode;
  panel?: React.ReactNode;
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
  let fullStoryName = currentStory.renderLabel?.(currentStory, api) || currentStory.name;

  let node = combinedIndex[currentStory.id];

  while (
    node &&
    'parent' in node &&
    node.parent &&
    combinedIndex[node.parent] &&
    fullStoryName.length < 24
  ) {
    node = combinedIndex[node.parent];
    const parentName = node.renderLabel?.(node, api) || node.name;
    fullStoryName = `${parentName}/${fullStoryName}`;
  }
  return fullStoryName;
};

export const MobileNavigation: FC<MobileNavigationProps & ComponentProps<typeof Container>> = ({
  menu,
  panel,
  showPanel,
  ...props
}) => {
  const { isMobileMenuOpen, isMobilePanelOpen, setMobileMenuOpen, setMobilePanelOpen } =
    useLayout();
  const fullStoryName = useFullStoryName();

  const handleAddonPanelClose = () => {
    setMobilePanelOpen(false);
  };

  return (
    <Container {...props}>
      <MobileMenuDrawer id="storybook-mobile-menu">{menu}</MobileMenuDrawer>

      <MobileAddonsDrawer
        id="storybook-mobile-addon-panel"
        isOpen={isMobilePanelOpen}
        onClose={handleAddonPanelClose}
      >
        {panel}
      </MobileAddonsDrawer>

      {!isMobilePanelOpen && (
        <Nav className="sb-bar" role="toolbar" aria-label="Mobile navigation controls">
          <Button
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="storybook-mobile-menu"
          >
            <MenuIcon />
            <Text>{fullStoryName}</Text>
          </Button>
          {showPanel && (
            <IconButton
              onClick={() => setMobilePanelOpen(true)}
              aria-label="Open addon panel"
              aria-expanded={isMobilePanelOpen}
              aria-controls="storybook-mobile-addon-panel"
            >
              <BottomBarToggleIcon />
            </IconButton>
          )}
        </Nav>
      )}
    </Container>
  );
};

const Container = styled.div(({ theme }) => ({
  bottom: 0,
  left: 0,
  width: '100%',
  zIndex: 10,
  background: theme.barBg,
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const Nav = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: 40,
  padding: '0 6px',
});

const Button = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: theme.barTextColor,
  fontSize: `${theme.typography.size.s2 - 1}px`,
  padding: '0 7px',
  fontWeight: theme.typography.weight.bold,
  WebkitLineClamp: 1,

  '> svg': {
    width: 14,
    height: 14,
    flexShrink: 0,
  },

  '&:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

const Text = styled.p({
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});
