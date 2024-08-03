import React, { Component } from 'react';
import { Tabs, IconButton, Link, EmptyTabContent } from '@storybook/core/components';
import type { State } from '@storybook/core/manager-api';
import { shortcutToHumanString } from '@storybook/core/manager-api';
import type { Addon_BaseType } from '@storybook/core/types';
import { styled } from '@storybook/core/theming';
import { BottomBarIcon, CloseIcon, DocumentIcon, SidebarAltIcon } from '@storybook/icons';
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
        {...(selectedPanel ? { selected: selectedPanel } : {})}
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
              <Link href={'https://storybook.js.org/integrations'} target="_blank" withArrow>
                <DocumentIcon /> Explore integrations catalog
              </Link>
            }
          />
        }
        tools={
          <Actions>
            {isDesktop ? (
              <>
                <IconButton
                  key="position"
                  onClick={actions.togglePosition}
                  title={`Change addon orientation [${shortcutToHumanString(
                    shortcuts.panelPosition
                  )}]`}
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
              <IconButton onClick={() => setMobilePanelOpen(false)} title="Close addon panel">
                <CloseIcon />
              </IconButton>
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
