import type { ReactNode } from 'react';
import React, { Component, useMemo } from 'react';

import { AriaTabs, EmptyTabContent, IconButton, Link } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon, CloseIcon, DocumentIcon, SidebarAltIcon } from '@storybook/icons';

import type { State } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
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

export const AddonPanel = React.memo<{
  selectedPanel?: string;
  actions: { onSelect: (id: string) => void } & Record<string, any>;
  panels: Record<string, Addon_BaseType>;
  shortcuts: State['shortcuts'];
  panelPosition?: 'bottom' | 'right';
  absolute?: boolean;
}>(({ panels, shortcuts, actions, selectedPanel = null, panelPosition = 'right' }) => {
  const { isDesktop, setMobilePanelOpen } = useLayout();

  const tabs = useMemo(
    () =>
      Object.entries(panels).map(([id, panel]) => ({
        id,
        title: typeof panel.title === 'function' ? <panel.title /> : panel.title,
        children: () => (
          <TabErrorBoundary key={id}>
            {/* FIXME: the original code seemed to always render as active: true.
            Changing this now breaks state management in addons like a11y. */}
            {panel.render({ active: true })}
          </TabErrorBoundary>
        ),
      })),
    [panels]
  );

  const emptyState = (
    <EmptyTabContent
      title="Storybook add-ons"
      description={
        <>Integrate your tools with Storybook to connect workflows and unlock advanced features.</>
      }
      footer={
        <Link href={'https://storybook.js.org/addons?ref=ui'} target="_blank" withArrow>
          <DocumentIcon /> Explore integrations catalog
        </Link>
      }
    />
  );

  const tools = (
    <ActionsWrapper>
      {isDesktop ? (
        <>
          <IconButton
            key="position"
            onClick={actions.togglePosition}
            title={`Change addon orientation [${shortcutToHumanString(shortcuts.panelPosition)}]`}
          >
            {panelPosition === 'bottom' ? <SidebarAltIcon /> : <BottomBarIcon />}
          </IconButton>
          <IconButton
            key="visibility"
            onClick={actions.toggleVisibility}
            title={`Hide addons [${shortcutToHumanString(shortcuts.togglePanel)}]`}
          >
            <CloseIcon />
          </IconButton>
        </>
      ) : (
        <IconButton onClick={() => setMobilePanelOpen(false)} aria-label="Close addon panel">
          <CloseIcon />
        </IconButton>
      )}
    </ActionsWrapper>
  );

  return (
    <Section aria-labelledby="storybook-panel-heading">
      <h2 id="storybook-panel-heading" className="sb-sr-only">
        Addon panel
      </h2>
      <AriaTabs
        id="storybook-panel-root"
        showToolsWhenEmpty
        panelProps={{
          id: 'panel-tab-content',
          hasScrollbar: false,
          renderAllChildren: true,
        }}
        emptyState={emptyState}
        selected={selectedPanel ?? undefined}
        onSelectionChange={(id) => actions.onSelect(id)}
        tabs={tabs}
        tools={tools}
      />
    </Section>
  );
});

AddonPanel.displayName = 'AddonPanel';

const ActionsWrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});
