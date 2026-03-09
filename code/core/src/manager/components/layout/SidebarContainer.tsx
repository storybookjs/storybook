import React from 'react';

import { styled } from 'storybook/theming';

import type { API_Layout } from '../../../types';
import { MINIMUM_CONTENT_WIDTH_PX } from '../../constants';
import { Drag } from './Drag';

interface SidebarContainerProps {
  children: React.ReactNode;
  navSize: number;
  rightPanelWidth: number;
  panelPosition: API_Layout['panelPosition'];
  sidebarResizerRef: React.Ref<HTMLDivElement>;
}

const Container = styled.div(({ theme }) => ({
  backgroundColor: theme.appBg,
  gridArea: 'sidebar',
  position: 'relative',
  borderRight: `1px solid ${theme.appBorderColor}`,
}));

const SidebarSlot = styled.div({
  height: '100%',
});

/**
 * Shows the sidebar and its resize drag handle. The drag handle is always rendered so users can
 * reopen the sidebar. The sidebar is always rendered (to preserve internal state), but it's
 * excluded from the Accessibility Object Model when effectively collapsed.
 */
const SidebarContainer = React.memo<SidebarContainerProps>(function SidebarContainer(props) {
  const { children, navSize, rightPanelWidth, panelPosition, sidebarResizerRef } = props;

  const shouldHideSidebarContent = navSize === 0;

  // The CSS grid reserves MINIMUM_CONTENT_WIDTH_PX for the content column (and the right panel
  // column when the panel is positioned on the right), so the sidebar cannot actually grow beyond
  // this effective maximum. Using window.innerWidth alone would cause aria-valuenow to overshoot
  // the visual size, making keyboard resizing appear unresponsive.
  const maxWidth =
    typeof window !== 'undefined'
      ? window.innerWidth -
        MINIMUM_CONTENT_WIDTH_PX -
        (panelPosition === 'right' ? rightPanelWidth : 0)
      : undefined;

  return (
    <Container>
      <SidebarSlot
        // This ensures that the sidebar content is not reachable by keyboard or assistive
        // tech when actually collapsed.
        hidden={shouldHideSidebarContent ? true : undefined}
        aria-hidden={shouldHideSidebarContent ? true : undefined}
      >
        {children}
      </SidebarSlot>
      <Drag
        ref={sidebarResizerRef}
        position="left"
        aria-label="Sidebar resize handle"
        aria-valuenow={navSize}
        aria-valuemax={maxWidth}
      />
    </Container>
  );
});

export { SidebarContainer };
