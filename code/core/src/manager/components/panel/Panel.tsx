import React, { Component } from 'react';

import { EmptyTabContent, IconButton, Link, Tabs } from 'storybook/internal/components';
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

interface SafeTabState {
  hasError: boolean;
  error?: Error;
}

class SafeTab extends Component<SafeTabProps, SafeTabState> {
  constructor(props: SafeTabProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ hasError: true, error });
    console.error(`Addon Error: ${error.message}`, info);
  }

  // @ts-expect-error (we know this is broken)
  render() {
    const { hasError, error } = this.state;
    const { children, id } = this.props;

    if (hasError) {
      return (
        <ErrorDisplay>
          <ErrorTitle>Addon Error</ErrorTitle>
          <ErrorDescription>
            This addon encountered an error. Other addons and stories remain accessible.
          </ErrorDescription>
          {error && <ErrorMessage>{error.message}</ErrorMessage>}
        </ErrorDisplay>
      );
    }

    return children;
  }
}

const ErrorDisplay = styled.div(({ theme }) => ({
  padding: '16px',
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  backgroundColor: theme.background.app,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.appBorderRadius,
  margin: '16px',
}));

const ErrorTitle = styled.h3(({ theme }) => ({
  margin: '0 0 8px',
  color: theme.color.negativeText,
  fontWeight: theme.typography.weight.bold,
}));

const ErrorDescription = styled.p(({ theme }) => ({
  margin: '0 0 8px',
}));

const ErrorMessage = styled.pre(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  overflow: 'auto',
  fontSize: theme.typography.size.s1,
  padding: '8px',
  backgroundColor: theme.background.content,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.appBorderRadius,
  margin: 0,
}));

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
