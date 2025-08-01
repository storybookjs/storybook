/* eslint-disable react/destructuring-assignment */
import type { FC, PropsWithChildren, ReactElement, ReactNode, SyntheticEvent } from 'react';
import React, { Component, memo, useMemo } from 'react';

import { sanitize } from 'storybook/internal/csf';
import type { Addon_RenderOptions } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

import { FlexBar } from '../bar/bar';
import { TabButton } from '../bar/button';
import { EmptyTabContent } from './EmptyTabContent';
import { VisuallyHidden, childrenToList } from './tabs.helpers';
import { useList } from './tabs.hooks';

const ignoreSsrWarning =
  '/* emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason */';

export interface WrapperProps {
  bordered?: boolean;
  absolute?: boolean;
}

const Wrapper = styled.div<WrapperProps>(
  ({ theme, bordered }) =>
    bordered
      ? {
          backgroundClip: 'padding-box',
          border: `1px solid ${theme.appBorderColor}`,
          borderRadius: theme.appBorderRadius,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }
      : {},
  ({ absolute }) =>
    absolute
      ? {
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }
      : {
          display: 'block',
        }
);

export const TabBar = styled.div({
  overflow: 'hidden',

  '&:first-of-type': {
    marginLeft: -3,
  },

  whiteSpace: 'nowrap',
  flexGrow: 1,
});

TabBar.displayName = 'TabBar';

export interface ContentProps {
  absolute?: boolean;
  bordered?: boolean;
}

const Content = styled.div<ContentProps>(
  {
    display: 'block',
    position: 'relative',
    container: 'tab-content / inline-size',
  },
  ({ theme }) => ({
    fontSize: theme.typography.size.s2 - 1,
    background: theme.background.content,
  }),
  ({ bordered, theme }) =>
    bordered
      ? {
          borderRadius: `0 0 ${theme.appBorderRadius - 1}px ${theme.appBorderRadius - 1}px`,
        }
      : {},
  ({ absolute, bordered }) =>
    absolute
      ? {
          height: `calc(100% - ${bordered ? 42 : 40}px)`,

          position: 'absolute',
          left: 0 + (bordered ? 1 : 0),
          right: 0 + (bordered ? 1 : 0),
          bottom: 0 + (bordered ? 1 : 0),
          top: 40 + (bordered ? 1 : 0),
          overflow: 'auto',
          [`& > *:first-child${ignoreSsrWarning}`]: {
            position: 'absolute',
            left: 0 + (bordered ? 1 : 0),
            right: 0 + (bordered ? 1 : 0),
            bottom: 0 + (bordered ? 1 : 0),
            top: 0 + (bordered ? 1 : 0),
            height: `calc(100% - ${bordered ? 2 : 0}px)`,
            overflow: 'auto',
          },
        }
      : {}
);

export interface TabWrapperProps {
  active: boolean;
  render?: () => ReactElement;
  children?: ReactNode;
}

export const TabWrapper: FC<TabWrapperProps> = ({ active, render, children }) => (
  <VisuallyHidden active={active}>{render ? render() : children}</VisuallyHidden>
);

export const panelProps = {};

export interface TabsProps {
  children?: ReactElement<{
    children: FC<Addon_RenderOptions & PropsWithChildren>;
    title: ReactNode | FC<PropsWithChildren>;
  }>[];
  id?: string;
  tools?: ReactNode;
  showToolsWhenEmpty?: boolean;
  emptyState?: ReactNode;
  selected?: string;
  actions?: {
    onSelect: (id: string) => void;
  } & Record<string, any>;
  backgroundColor?: string;
  absolute?: boolean;
  bordered?: boolean;
  menuName?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  active: boolean;
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
    if (this.state.hasError && this.props.active) {
      return (
        <EmptyTabContent
          title="This addon has errors"
          description="Check your browser logs and addon code to pinpoint what went wrong. This issue was not caused by Storybook."
        />
      );
    }

    return this.props.children;
  }
}

export const Tabs: FC<TabsProps> = memo(
  ({
    children,
    selected = null,
    actions,
    absolute = false,
    bordered = false,
    tools = null,
    backgroundColor,
    id: htmlId = null,
    menuName = 'Tabs',
    emptyState,
    showToolsWhenEmpty,
  }) => {
    const list = useMemo(
      () =>
        childrenToList(children).map((i, index) => ({
          ...i,
          active: selected ? i.id === selected : index === 0,
        })),
      [children, selected]
    );

    const { visibleList, tabBarRef, tabRefs, AddonTab } = useList(list);

    const EmptyContent = emptyState ?? <EmptyTabContent title="Nothing found" />;

    if (!showToolsWhenEmpty && list.length === 0) {
      return EmptyContent;
    }

    return (
      // @ts-expect-error (non strict)
      <Wrapper absolute={absolute} bordered={bordered} id={htmlId}>
        <FlexBar scrollable={false} border backgroundColor={backgroundColor}>
          {/* @ts-expect-error (non strict) */}
          <TabBar style={{ whiteSpace: 'normal' }} ref={tabBarRef} role="tablist">
            {visibleList.map(({ title, id, active, color }, index) => {
              const indexId = `index-${index}`;

              return (
                <TabButton
                  id={`tabbutton-${sanitize(id) ?? indexId}`}
                  ref={(ref: HTMLButtonElement) => {
                    tabRefs.current.set(id, ref);
                  }}
                  className={`tabbutton ${active ? 'tabbutton-active' : ''}`}
                  type="button"
                  key={id}
                  active={active}
                  textColor={color}
                  onClick={(e: SyntheticEvent) => {
                    e.preventDefault();
                    // @ts-expect-error (non strict)
                    actions.onSelect(id);
                  }}
                  role="tab"
                >
                  {typeof title === 'function' ? <title /> : title}
                </TabButton>
              );
            })}
            <AddonTab menuName={menuName} actions={actions} />
          </TabBar>
          {tools}
        </FlexBar>
        <Content id="panel-tab-content" bordered={bordered} absolute={absolute}>
          {list.length
            ? list.map(({ id, active, render }) => {
                return (
                  <TabErrorBoundary key={id} active={active}>
                    {React.createElement(render, { active }, null)}
                  </TabErrorBoundary>
                );
              })
            : EmptyContent}
        </Content>
      </Wrapper>
    );
  }
);
Tabs.displayName = 'Tabs';

export interface TabsStateProps {
  children: TabsProps['children'];
  initial: string;
  absolute: boolean;
  bordered: boolean;
  backgroundColor: string;
  menuName: string;
}

export interface TabsStateState {
  selected: string;
}

export class TabsState extends Component<TabsStateProps, TabsStateState> {
  static defaultProps: TabsStateProps = {
    children: [],
    // @ts-expect-error (non strict)
    initial: null,
    absolute: false,
    bordered: false,
    backgroundColor: '',
    // @ts-expect-error (non strict)
    menuName: undefined,
  };

  constructor(props: TabsStateProps) {
    super(props);

    this.state = {
      selected: props.initial,
    };
  }

  handlers = {
    onSelect: (id: string) => this.setState({ selected: id }),
  };

  render() {
    const { bordered = false, absolute = false, children, backgroundColor, menuName } = this.props;
    const { selected } = this.state;
    return (
      <Tabs
        bordered={bordered}
        absolute={absolute}
        selected={selected}
        backgroundColor={backgroundColor}
        menuName={menuName}
        actions={this.handlers}
      >
        {children}
      </Tabs>
    );
  }
}
