import React, { Component } from 'react';

import { Button, EmptyTabContent, Link, Tabs } from 'storybook/internal/components';
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

class SafeTab extends Component<SafeTabProps, { hasError: boolean }> {
  constructor(props: SafeTabProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ hasError: true });

    console.error(error, info);
  }

  // @ts-expect-error (we know this is broken)
  render() {
    const { hasError } = this.state;
    const { children } = this.props;
    if (hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return children;
  }
}

export const AddonPanel = React.memo<{
  selectedPanel?: string;
  actions: { onSelect: (id: string) => void } & Record<string, any>;
  panels: Record<string, Addon_BaseType>;
  shortcuts: State['shortcuts'];
  panelPosition?: 'bottom' | 'right';
  absolute?: boolean;
}>(
  ({
    panels,
    shortcuts,
    actions,
    selectedPanel = null,
    panelPosition = 'right',
    absolute = true,
  }) => {
    const { isDesktop, setMobilePanelOpen } = useLayout();

    return (
      <Tabs
        absolute={absolute}
        {...(selectedPanel && panels[selectedPanel] ? { selected: selectedPanel } : {})}
        menuName="Addons"
        actions={actions}
        showToolsWhenEmpty
        emptyState={
          <EmptyTabContent
            title="Storybook add-ons"
            description={
              <>
                Integrate your tools with Storybook to connect workflows and unlock advanced
                features.
              </>
            }
            footer={
              <Link href={'https://storybook.js.org/addons?ref=ui'} target="_blank" withArrow>
                <DocumentIcon /> Explore integrations catalog
              </Link>
            }
          />
        }
        tools={
          <Actions>
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
          </Actions>
        }
        id="storybook-panel-root"
      >
        {Object.entries(panels).map(([k, v]) => (
          // @ts-expect-error (we know this is broken)
          <SafeTab key={k} id={k} title={typeof v.title === 'function' ? <v.title /> : v.title}>
            {v.render}
          </SafeTab>
        ))}
      </Tabs>
    );
  }
);

AddonPanel.displayName = 'AddonPanel';

const Actions = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});
