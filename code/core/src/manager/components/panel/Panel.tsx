import type { ReactNode } from 'react';
import React, { Component, useMemo } from 'react';

import {
  Button,
  EmptyTabContent,
  Link,
  StatelessTab,
  StatelessTabList,
  StatelessTabPanel,
  StatelessTabsView,
} from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon, CloseIcon, DocumentIcon, SidebarAltIcon } from '@storybook/icons';

import type { State } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLayout } from '../layout/LayoutProvider';

export interface SafeTabProps {
  title: Addon_BaseType['title'];
  id: string;
  children: Addon_BaseType['render'];
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class TabErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error rendering addon panel');
    console.error(error);
    console.error(info.componentStack);
  }

  render() {
    const { hasError } = this.state;
    if (hasError) {
      return (
        <EmptyTabContent
          title="This addon has errors"
          description="Check your browser logs and addon code to pinpoint what went wrong. This issue was not caused by Storybook."
        />
      );
    }

    const { children } = this.props;
    return children;
  }
}

const Section = styled.section({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

// Avoids crashes due to rules of hooks.
const PreRenderAddons = ({ panels }: { panels: Record<string, Addon_BaseType> }) => {
  return Object.entries(panels).map(([k, v]) => (
    <StatelessTabPanel key={k} name={k} hasScrollbar={false}>
      <TabErrorBoundary key={k}>{v.render({ active: true })}</TabErrorBoundary>
    </StatelessTabPanel>
  ));
};

export const AddonPanel = React.memo<{
  selectedPanel?: string;
  actions: { onSelect: (id: string) => void } & Record<string, any>;
  panels: Record<string, Addon_BaseType>;
  shortcuts: State['shortcuts'];
  panelPosition?: 'bottom' | 'right';
  absolute?: boolean;
}>(({ panels, shortcuts, actions, selectedPanel = null, panelPosition = 'right' }) => {
  const { isDesktop, setMobilePanelOpen } = useLayout();

  const emptyState = (
    <EmptyTabContent
      title="Storybook add-ons"
      description={
        <>Integrate your tools with Storybook to connect workflows and unlock advanced features.</>
      }
      footer={
        <Link href={'https://storybook.js.org/addons/?ref=ui'} target="_blank" withArrow>
          <DocumentIcon /> Explore integrations catalog
        </Link>
      }
    />
  );

  const tools = useMemo(
    () => (
      <ActionsWrapper>
        {isDesktop ? (
          <>
            <Button
              key="position"
              padding="small"
              variant="ghost"
              onClick={actions.togglePosition}
              ariaLabel={
                panelPosition === 'bottom'
                  ? 'Move addon panel to right'
                  : 'Move addon panel to bottom'
              }
              ariaDescription="Changes the location of the addon panel to the bottom or right of the screen, but does not have any effect on its content."
              shortcut={shortcuts.panelPosition}
            >
              {panelPosition === 'bottom' ? <SidebarAltIcon /> : <BottomBarIcon />}
            </Button>
            <Button
              key="visibility"
              padding="small"
              variant="ghost"
              onClick={actions.toggleVisibility}
              ariaLabel="Hide addon panel"
              shortcut={shortcuts.togglePanel}
            >
              <CloseIcon />
            </Button>
          </>
        ) : (
          <Button
            padding="small"
            variant="ghost"
            onClick={() => setMobilePanelOpen(false)}
            ariaLabel="Close addon panel"
          >
            <CloseIcon />
          </Button>
        )}
      </ActionsWrapper>
    ),
    [actions, isDesktop, panelPosition, setMobilePanelOpen, shortcuts]
  );

  return (
    <Section aria-labelledby="storybook-panel-heading">
      <h2 id="storybook-panel-heading" className="sb-sr-only">
        Addon panel
      </h2>
      <StatelessTabsView
        id="storybook-panel-root"
        showToolsWhenEmpty
        emptyState={emptyState}
        selected={selectedPanel ?? undefined}
        onSelectionChange={(id) => actions.onSelect(id)}
        tools={tools}
      >
        <StatelessTabList aria-label="Available addons">
          {Object.entries(panels).map(([k, v]) => (
            <StatelessTab key={k} name={k}>
              {typeof v.title === 'function' ? <v.title /> : v.title}
            </StatelessTab>
          ))}
        </StatelessTabList>
        {Object.keys(panels).length ? <PreRenderAddons panels={panels} /> : null}
      </StatelessTabsView>
    </Section>
  );
});

AddonPanel.displayName = 'AddonPanel';

const ActionsWrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});
