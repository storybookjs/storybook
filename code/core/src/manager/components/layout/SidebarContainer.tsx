import React from 'react';

import { styled } from 'storybook/theming';

import { focusableUIElements } from '../../../manager-api/modules/layout';
import { Drag } from './Drag';

interface SidebarContainerProps {
  children: React.ReactNode;
  navSize: number;
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
  const { children, navSize, sidebarResizerRef } = props;

  const shouldHideSidebarContent = navSize === 0;

  return (
    <Container id={focusableUIElements.sidebarRegion}>
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
        aria-valuemax={typeof window !== 'undefined' ? window.innerWidth : undefined}
      />
    </Container>
  );
});

export { SidebarContainer };
