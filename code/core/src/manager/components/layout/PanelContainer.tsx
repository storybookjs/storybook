import React from 'react';

import { styled } from 'storybook/theming';

import type { API_Layout } from '../../../types';
import { MINIMUM_CONTENT_WIDTH_PX } from '../../constants';
import { Drag } from './Drag';

interface PanelContainerProps {
  children: React.ReactNode;
  bottomPanelHeight: number;
  rightPanelWidth: number;
  navSize: number;
  panelResizerRef: React.Ref<HTMLDivElement>;
  position: API_Layout['panelPosition'];
}

const Container = styled.div<{ position: API_Layout['panelPosition'] }>(({ theme, position }) => ({
  gridArea: 'panel',
  position: 'relative',
  backgroundColor: theme.appContentBg,
  borderTop: position === 'bottom' ? `1px solid ${theme.appBorderColor}` : undefined,
  borderLeft: position === 'right' ? `1px solid ${theme.appBorderColor}` : undefined,
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
  const { children, bottomPanelHeight, rightPanelWidth, navSize, panelResizerRef, position } =
    props;
  const resolvedPosition = position ?? 'bottom';

  const shouldHidePanelContent =
    resolvedPosition === 'bottom' ? bottomPanelHeight === 0 : rightPanelWidth === 0;

  // The CSS grid reserves MINIMUM_CONTENT_WIDTH_PX for the content column (and the sidebar
  // column when the panel is positioned on the right), so the panel cannot actually grow beyond
  // this effective maximum. Using window.innerWidth alone would cause aria-valuenow to overshoot
  // the visual size, making keyboard resizing appear unresponsive.
  const maxSize =
    typeof window !== 'undefined'
      ? resolvedPosition === 'bottom'
        ? window.innerHeight
        : window.innerWidth - MINIMUM_CONTENT_WIDTH_PX - navSize
      : undefined;

  return (
    <Container position={resolvedPosition}>
      <Drag
        ref={panelResizerRef}
        position={resolvedPosition}
        overlapping={resolvedPosition === 'bottom' ? !!bottomPanelHeight : !!rightPanelWidth}
        aria-label="Addon panel resize handle"
        aria-valuenow={resolvedPosition === 'bottom' ? bottomPanelHeight : rightPanelWidth}
        aria-valuemax={maxSize}
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
