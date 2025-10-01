import type { FC, ReactNode } from 'react';
import React from 'react';

import { Bar, EmptyTabContent } from 'storybook/internal/components';
import type { TabsViewProps } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

// import { Tabs } from 'react-aria-components';
const Tabs = (props: any) => <div {...props} />;

const Container = styled(Tabs)<{ $simulatedGap: string | number }>(({ $simulatedGap }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',

  '.tablist': {
    flex: '1 1 100%',
  },

  '.tablist.tablist-has-scroll': {
    marginInlineEnd: $simulatedGap,
  },

  '& > :not(:first-child)': { flex: 1 },
}));

export interface StatelessTabsViewProps extends Omit<TabsViewProps, 'tabs'> {
  children: ReactNode;
}

export const StatelessTabsView: FC<StatelessTabsViewProps> = ({
  backgroundColor,
  barInnerStyle,
  children,
  defaultSelected,
  emptyState,
  onSelectionChange,
  selected,
  showToolsWhenEmpty,
  tools,
  ...props
}) => {
  const EmptyContent = emptyState ?? <EmptyTabContent title="Nothing found" />;
  const [tabListChild, ...tabPanelChildren] = React.Children.toArray(children);
  if (!showToolsWhenEmpty && tabPanelChildren?.length === 0) {
    return EmptyContent;
  }

  return (
    <Container
      {...props}
      $simulatedGap={barInnerStyle?.gap ?? 6}
      defaultSelectedKey={defaultSelected}
      onSelectionChange={(k: any) => onSelectionChange?.(k ? `${k}` : '')}
      selectedKey={selected}
    >
      <Bar
        scrollable={false}
        border
        backgroundColor={backgroundColor}
        innerStyle={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingInlineStart: 0,
          paddingInlineEnd: 10,
          // A11y: the tools must be before the tab list in the DOM for correct tab order.
          // This lets us control order without adding a wrapper div, leading to better flex
          // behavior on tools for our callees (e.g. containerType: 'inline-size' in a11y-addon).
          '> *:not(:last-child)': {
            order: 2,
          },
          '> *': {
            flexShrink: 0,
          },
          ...barInnerStyle,
          gap: 0,
        }}
      >
        {tools}
        {tabListChild}
      </Bar>
      {tabPanelChildren}
    </Container>
  );
};
