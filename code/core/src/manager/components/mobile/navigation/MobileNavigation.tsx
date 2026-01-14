import React, { useRef } from 'react';
import type { ComponentProps, FC } from 'react';

import { Button } from 'storybook/internal/components';
import type { API_IndexHash, API_Refs } from 'storybook/internal/types';

import { BottomBarToggleIcon, MenuIcon } from '@storybook/icons';

import { useId } from '@react-aria/utils';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLandmark } from '../../../hooks/useLandmark';
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
  const headingId = useId();

  const sectionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { 'aria-labelledby': headingId, role: 'banner' },
    sectionRef
  );

  return (
    <Container {...props}>
      <MobileMenuDrawer
        id="storybook-mobile-menu"
        isOpen={isMobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      >
        {menu}
      </MobileMenuDrawer>

      <MobileAddonsDrawer
        id="storybook-mobile-addon-panel"
        isOpen={isMobilePanelOpen}
        onOpenChange={setMobilePanelOpen}
      >
        {panel}
      </MobileAddonsDrawer>

      {!isMobilePanelOpen && (
        <MobileBottomBar className="sb-bar" {...landmarkProps} ref={sectionRef}>
          <h2 id={headingId} className="sb-sr-only">
            Navigation controls
          </h2>
          <BottomBarButton
            padding="small"
            variant="ghost"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            ariaLabel="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="storybook-mobile-menu"
          >
            <MenuIcon />
            <Text>{fullStoryName}</Text>
          </BottomBarButton>
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
              aria-controls="storybook-mobile-addon-panel"
            >
              <BottomBarToggleIcon />
            </BottomBarButton>
          )}
        </MobileBottomBar>
      )}
    </Container>
  );
};

const Container = styled.section({
  bottom: 0,
  left: 0,
  width: '100%',
  zIndex: 10,
  background: 'var(--sb-barBg)',
  borderTop: `1px solid var(--sb-appBorderColor)`,
});

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
