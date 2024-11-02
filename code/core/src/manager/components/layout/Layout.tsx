import React, { useEffect, useLayoutEffect, useState } from 'react';

import { Match } from '@storybook/core/router';
import { styled } from '@storybook/core/theming';
import type { API_Layout, API_ViewMode } from '@storybook/core/types';

import type { API } from '@storybook/core/manager-api';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';
import { Notifications } from '../../container/Notifications';
import { MobileNavigation } from '../mobile/navigation/MobileNavigation';
import { useLayout } from './LayoutProvider';
import { useDragging } from './useDragging';

interface InternalLayoutState {
  isDragging: boolean;
}

interface ManagerLayoutState
  extends Pick<API_Layout, 'navSize' | 'bottomPanelHeight' | 'rightPanelWidth' | 'panelPosition'> {
  viewMode: API_ViewMode;
}

export type LayoutState = InternalLayoutState & ManagerLayoutState;

interface Props {
  api: API;
  managerLayoutState: ManagerLayoutState;
  setManagerLayoutState: (state: Partial<Omit<ManagerLayoutState, 'viewMode'>>) => void;
  slotMain?: React.ReactNode;
  slotSidebar?: React.ReactNode;
  slotPanel?: React.ReactNode;
  slotPages?: React.ReactNode;
  hasTab: boolean;
}
const MINIMUM_CONTENT_WIDTH_PX = 100;

const layoutStateIsEqual = (state: ManagerLayoutState, other: ManagerLayoutState) =>
  state.navSize === other.navSize &&
  state.bottomPanelHeight === other.bottomPanelHeight &&
  state.rightPanelWidth === other.rightPanelWidth &&
  state.panelPosition === other.panelPosition;

/**
 * Manages the internal state of panels while dragging, and syncs it with the layout state in the
 * global manager store when the user is done dragging. Also syncs the layout state from the global
 * manager store to the internal state here when necessary
 */
const useLayoutSyncingState = ({
  api,
  managerLayoutState,
  setManagerLayoutState,
  isDesktop,
  hasTab,
}: {
  api: API;
  managerLayoutState: Props['managerLayoutState'];
  setManagerLayoutState: Props['setManagerLayoutState'];
  isDesktop: boolean;
  hasTab: boolean;
}) => {
  // ref to keep track of previous managerLayoutState, to check if the props change
  const prevManagerLayoutStateRef = React.useRef<ManagerLayoutState>(managerLayoutState);

  const [internalDraggingSizeState, setInternalDraggingSizeState] = useState<LayoutState>({
    ...managerLayoutState,
    isDragging: false,
  });

  /** Sync FROM managerLayoutState to internalDraggingState if user is not dragging */
  useEffect(() => {
    if (
      internalDraggingSizeState.isDragging || // don't interrupt user's drag
      layoutStateIsEqual(managerLayoutState, prevManagerLayoutStateRef.current) // don't set any state if managerLayoutState hasn't changed
    ) {
      return;
    }
    prevManagerLayoutStateRef.current = managerLayoutState;
    setInternalDraggingSizeState((state) => ({ ...state, ...managerLayoutState }));
  }, [internalDraggingSizeState.isDragging, managerLayoutState, setInternalDraggingSizeState]);

  /** Sync size changes TO managerLayoutState when drag is done */
  useLayoutEffect(() => {
    if (
      internalDraggingSizeState.isDragging || // wait with syncing managerLayoutState until user is done dragging
      layoutStateIsEqual(managerLayoutState, internalDraggingSizeState) // don't sync managerLayoutState if it doesn't differ from internalDraggingSizeStatee)
    ) {
      return;
    }
    const nextState = {
      navSize: internalDraggingSizeState.navSize,
      bottomPanelHeight: internalDraggingSizeState.bottomPanelHeight,
      rightPanelWidth: internalDraggingSizeState.rightPanelWidth,
    };
    prevManagerLayoutStateRef.current = {
      ...prevManagerLayoutStateRef.current,
      ...nextState,
    };
    setManagerLayoutState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalDraggingSizeState, setManagerLayoutState]);

  const isPagesShown =
    managerLayoutState.viewMode !== 'story' && managerLayoutState.viewMode !== 'docs';
  const isPanelShown = managerLayoutState.viewMode === 'story' && !hasTab;

  const { panelResizerRef, sidebarResizerRef } = useDragging({
    setState: setInternalDraggingSizeState,
    isPanelShown,
    isDesktop,
  });
  const { navSize, rightPanelWidth, bottomPanelHeight } = internalDraggingSizeState.isDragging
    ? internalDraggingSizeState
    : managerLayoutState;

  const customisedNavSize = api.getNavSizeWithCustomisations(navSize);

  return {
    navSize: customisedNavSize,
    rightPanelWidth,
    bottomPanelHeight,
    panelPosition: managerLayoutState.panelPosition,
    panelResizerRef,
    sidebarResizerRef,
    showPages: isPagesShown,
    showPanel: isPanelShown,
    isDragging: internalDraggingSizeState.isDragging,
  };
};

export const Layout = ({
  api,
  managerLayoutState,
  setManagerLayoutState,
  hasTab,
  ...slots
}: Props) => {
  const { isDesktop, isMobile } = useLayout();

  const {
    navSize,
    rightPanelWidth,
    bottomPanelHeight,
    panelPosition,
    panelResizerRef,
    sidebarResizerRef,
    showPages,
    showPanel,
    isDragging,
  } = useLayoutSyncingState({ api, managerLayoutState, setManagerLayoutState, isDesktop, hasTab });

  return (
    <LayoutContainer
      navSize={navSize}
      rightPanelWidth={rightPanelWidth}
      bottomPanelHeight={bottomPanelHeight}
      panelPosition={managerLayoutState.panelPosition}
      isDragging={isDragging}
      viewMode={managerLayoutState.viewMode}
      showPanel={showPanel}
    >
      {showPages && <PagesContainer>{slots.slotPages}</PagesContainer>}
      <Match path={/(^\/story|docs|onboarding\/|^\/$)/} startsWith={false}>
        {({ match }) => <ContentContainer shown={!!match}>{slots.slotMain}</ContentContainer>}
      </Match>
      {isDesktop && (
        <>
          <SidebarContainer>
            <Drag ref={sidebarResizerRef} />
            {slots.slotSidebar}
          </SidebarContainer>
          {showPanel && (
            <PanelContainer position={panelPosition}>
              <Drag
                orientation={panelPosition === 'bottom' ? 'horizontal' : 'vertical'}
                position={panelPosition === 'bottom' ? 'left' : 'right'}
                ref={panelResizerRef}
              />
              {slots.slotPanel}
            </PanelContainer>
          )}
        </>
      )}
      {isMobile && (
        <>
          <Notifications />
          <MobileNavigation
            menu={slots.slotSidebar}
            panel={slots.slotPanel}
            showPanel={showPanel}
          />
        </>
      )}
    </LayoutContainer>
  );
};

const LayoutContainer = styled.div<LayoutState & { showPanel: boolean }>(
  ({ navSize, rightPanelWidth, bottomPanelHeight, viewMode, panelPosition, showPanel }) => {
    return {
      width: '100%',
      height: ['100vh', '100dvh'], // This array is a special Emotion syntax to set a fallback if 100dvh is not supported
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',

      [MEDIA_DESKTOP_BREAKPOINT]: {
        display: 'grid',
        gap: 0,
        gridTemplateColumns: `minmax(0, ${navSize}px) minmax(${MINIMUM_CONTENT_WIDTH_PX}px, 1fr) minmax(0, ${rightPanelWidth}px)`,
        gridTemplateRows: `1fr minmax(0, ${bottomPanelHeight}px)`,
        gridTemplateAreas: (() => {
          if (viewMode === 'docs' || !showPanel) {
            // remove panel in docs viewMode
            return `"sidebar content content"
                  "sidebar content content"`;
          }
          if (panelPosition === 'right') {
            return `"sidebar content panel"
                  "sidebar content panel"`;
          }
          return `"sidebar content content"
                "sidebar panel   panel"`;
        })(),
      },
    };
  }
);

const SidebarContainer = styled.div(({ theme }) => ({
  backgroundColor: theme.background.app,
  gridArea: 'sidebar',
  position: 'relative',
  borderRight: `1px solid ${theme.color.border}`,
}));

const ContentContainer = styled.div<{ shown: boolean }>(({ theme, shown }) => ({
  flex: 1,
  position: 'relative',
  backgroundColor: theme.background.content,
  display: shown ? 'grid' : 'none', // This is needed to make the content container fill the available space
  overflow: 'auto',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    flex: 'auto',
    gridArea: 'content',
  },
}));

const PagesContainer = styled.div(({ theme }) => ({
  gridRowStart: 'sidebar-start',
  gridRowEnd: '-1',
  gridColumnStart: 'sidebar-end',
  gridColumnEnd: '-1',
  backgroundColor: theme.background.content,
  zIndex: 1,
}));

const PanelContainer = styled.div<{ position: LayoutState['panelPosition'] }>(
  ({ theme, position }) => ({
    gridArea: 'panel',
    position: 'relative',
    backgroundColor: theme.background.content,
    borderTop: position === 'bottom' ? `1px solid ${theme.color.border}` : undefined,
    borderLeft: position === 'right' ? `1px solid ${theme.color.border}` : undefined,
  })
);

const Drag = styled.div<{ orientation?: 'horizontal' | 'vertical'; position?: 'left' | 'right' }>(
  ({ theme }) => ({
    position: 'absolute',
    opacity: 0,
    transition: 'opacity 0.2s ease-in-out',
    zIndex: 100,

    '&:after': {
      content: '""',
      display: 'block',
      backgroundColor: theme.color.secondary,
    },

    '&:hover': {
      opacity: 1,
    },
  }),
  ({ orientation = 'vertical', position = 'left' }) => {
    if (orientation === 'vertical') {
      return {
        width: position === 'left' ? 10 : 13,
        height: '100%',
        top: 0,
        right: position === 'left' ? '-7px' : undefined,
        left: position === 'right' ? '-7px' : undefined,

        '&:after': {
          width: 1,
          height: '100%',
          marginLeft: position === 'left' ? 3 : 6,
        },

        '&:hover': {
          cursor: 'col-resize',
        },
      };
    }
    return {
      width: '100%',
      height: '13px',
      top: '-7px',
      left: 0,

      '&:after': {
        width: '100%',
        height: 1,
        marginTop: 6,
      },

      '&:hover': {
        cursor: 'row-resize',
      },
    };
  }
);
