import type { CSSProperties } from 'react';
import React, { useEffect, useLayoutEffect, useState } from 'react';

import { Match } from 'storybook/internal/router';
import type { API_Layout, API_ViewMode } from 'storybook/internal/types';

import { type API, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';
import { Notifications } from '../../container/Notifications';
import { MobileNavigation } from '../mobile/navigation/MobileNavigation';
import { useLayout } from './LayoutProvider';
import { useDragging } from './useDragging';
import { useLandmarkIndicator } from './useLandmarkIndicator';

interface InternalLayoutState {
  isDragging: boolean;
}

interface ManagerLayoutState extends Pick<
  API_Layout,
  'navSize' | 'bottomPanelHeight' | 'rightPanelWidth' | 'panelPosition'
> {
  viewMode: API_ViewMode;
}

export type LayoutState = InternalLayoutState & ManagerLayoutState;

interface Props {
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

  const customisedNavSize = api.getNavSizeWithCustomisations?.(navSize) ?? navSize;
  const customisedShowPanel = api.getShowPanelWithCustomisations?.(isPanelShown) ?? isPanelShown;

  return {
    navSize: customisedNavSize,
    rightPanelWidth,
    bottomPanelHeight,
    panelPosition: managerLayoutState.panelPosition,
    panelResizerRef,
    sidebarResizerRef,
    showPages: isPagesShown,
    showPanel: customisedShowPanel,
    isDragging: internalDraggingSizeState.isDragging,
  };
};

const MainContentMatcher = ({ children }: { children: React.ReactNode }) => {
  return (
    <Match path={/(^\/story|docs|onboarding\/|^\/$)/} startsWith={false}>
      {({ match }) => <ContentContainer shown={!!match}>{children}</ContentContainer>}
    </Match>
  );
};

const OrderedMobileNavigation = styled(MobileNavigation)({
  order: 1,
});

export const Layout = ({ managerLayoutState, setManagerLayoutState, hasTab, ...slots }: Props) => {
  const { isDesktop, isMobile } = useLayout();
  const api = useStorybookApi();

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

  // Install landmark navigation listener in parent container of all landmarks.
  useLandmarkIndicator();

  return (
    <LayoutContainer
      panelPosition={managerLayoutState.panelPosition}
      showPanel={showPanel}
      style={
        {
          '--nav-width': `${navSize}px`,
          '--right-panel-width': `${rightPanelWidth}px`,
          '--bottom-panel-height': `${bottomPanelHeight}px`,
        } as CSSProperties
      }
    >
      {showPages && <PagesContainer>{slots.slotPages}</PagesContainer>}
      <>
        {isDesktop && (
          <SidebarContainer>
            <Drag ref={sidebarResizerRef} />
            {slots.slotSidebar}
          </SidebarContainer>
        )}
        {isMobile && (
          <OrderedMobileNavigation
            menu={slots.slotSidebar}
            panel={slots.slotPanel}
            showPanel={showPanel}
          />
        )}

        <MainContentMatcher>{slots.slotMain}</MainContentMatcher>

        {isDesktop && showPanel && (
          <PanelContainer position={panelPosition}>
            <Drag
              orientation={panelPosition === 'bottom' ? 'horizontal' : 'vertical'}
              overlapping={panelPosition === 'bottom' ? !!bottomPanelHeight : !!rightPanelWidth}
              position={panelPosition === 'bottom' ? 'left' : 'right'}
              ref={panelResizerRef}
            />
            {slots.slotPanel}
          </PanelContainer>
        )}
        {isMobile && <Notifications />}
      </>
    </LayoutContainer>
  );
};

const LayoutContainer = styled.div<{
  panelPosition: LayoutState['panelPosition'];
  showPanel: boolean;
}>(({ panelPosition, showPanel }) => ({
  width: '100%',
  height: ['100vh', '100dvh'],
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  colorScheme: 'light dark',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    display: 'grid',
    gap: 0,
    gridTemplateColumns: `minmax(0, var(--nav-width)) minmax(${MINIMUM_CONTENT_WIDTH_PX}px, 1fr) minmax(0, var(--right-panel-width))`,
    gridTemplateRows: `1fr minmax(0, var(--bottom-panel-height))`,
    gridTemplateAreas: (() => {
      if (!showPanel) {
        // showPanel is false by default when viewMode is not 'story', but can be overridden by the user
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
}));

const SidebarContainer = styled.div(({ theme }) => ({
  backgroundColor: theme.appBg,
  gridArea: 'sidebar',
  position: 'relative',
  borderRight: `1px solid ${theme.appBorderColor}`,
}));

const ContentContainer = styled.div<{ shown: boolean }>(({ theme, shown }) => ({
  flex: 1,
  position: 'relative',
  backgroundColor: theme.appContentBg,
  display: shown ? 'grid' : 'none', // This is needed to make the content container fill the available space
  overflow: 'auto',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    flex: 'auto',
    gridArea: 'content',
  },
}));

const PagesContainer = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gridRowStart: 'sidebar-start',
  gridRowEnd: '-1',
  gridColumnStart: 'sidebar-end',
  gridColumnEnd: '-1',
  backgroundColor: theme.appContentBg,
  zIndex: 1,
}));

const PanelContainer = styled.div<{ position: LayoutState['panelPosition'] }>(
  ({ theme }) => ({
    gridArea: 'panel',
    position: 'relative',
    backgroundColor: theme.appContentBg,
    '& > aside': {
      overflow: 'hidden',
    },
  }),
  ({ theme, position }) =>
    position === 'bottom' && { boxShadow: `0 -1px 0 0 ${theme.appBorderColor}` },
  ({ theme, position }) =>
    position === 'right' && { boxShadow: `-1px 0 0 0 ${theme.appBorderColor}` }
);

const Drag = styled.div<{
  orientation?: 'horizontal' | 'vertical';
  overlapping?: boolean;
  position?: 'left' | 'right';
}>(
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
  ({ orientation = 'vertical', overlapping = true, position = 'left' }) =>
    orientation === 'vertical'
      ? {
          width: overlapping ? (position === 'left' ? 10 : 13) : 7,
          height: '100%',
          top: 0,
          right: position === 'left' ? -7 : undefined,
          left: position === 'right' ? -7 : undefined,

          '&:after': {
            width: 1,
            height: '100%',
            marginLeft: position === 'left' ? 3 : 6,
          },

          '&:hover': {
            cursor: 'col-resize',
          },
        }
      : {
          width: '100%',
          height: overlapping ? 13 : 7,
          top: -7,
          left: 0,

          '&:after': {
            width: '100%',
            height: 1,
            marginTop: 6,
          },

          '&:hover': {
            cursor: 'row-resize',
          },
        }
);
