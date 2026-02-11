import React from 'react';

import { styled } from 'storybook/theming';

import type { API_Layout } from '../../../types';
import { Drag } from './Drag';

interface PanelContainerProps {
  children: React.ReactNode;
  bottomPanelHeight: number;
  rightPanelWidth: number;
  panelResizerRef: React.Ref<HTMLDivElement>;
  position: API_Layout['panelPosition'];
}

const Container = styled.div<{ position: API_Layout['panelPosition'] }>(({ theme, position }) => ({
  gridArea: 'panel',
  position: 'relative',
  backgroundColor: theme.appContentBg,
  borderTop: position === 'bottom' ? `1px solid ${theme.appBorderColor}` : undefined,
  borderLeft: position === 'right' ? `1px solid ${theme.appBorderColor}` : undefined,
  '& > aside': {
    overflow: 'hidden',
  },
}));

const PanelSlot = styled.div({
  height: '100%',
});

/**
 * Shows the addon panel and its resize drag handle. The drag handle is always rendered so users can
 * reopen the panel. The panel is always rendered (to preserve internal state), but it's excluded
 * from the Accessibility Object Model when effectively collapsed.
 */
const PanelContainer = React.memo<PanelContainerProps>(function PanelContainer(props) {
  const { children, bottomPanelHeight, rightPanelWidth, panelResizerRef, position } = props;

  const shouldHidePanelContent =
    position === 'bottom' ? bottomPanelHeight === 0 : rightPanelWidth === 0;

  return (
    <Container position={position}>
      <Drag
        orientation={position === 'bottom' ? 'horizontal' : 'vertical'}
        overlapping={position === 'bottom' ? !!bottomPanelHeight : !!rightPanelWidth}
        position={position === 'bottom' ? 'left' : 'right'}
        ref={panelResizerRef}
      />
      <PanelSlot
        // This ensures that the panel content is not reachable by keyboard or assistive
        // tech when actually collapsed.
        hidden={shouldHidePanelContent ? true : undefined}
        aria-hidden={shouldHidePanelContent ? true : undefined}
      >
        {children}
      </PanelSlot>
    </Container>
  );
});

export { PanelContainer };
