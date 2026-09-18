import type { FC } from 'react';
import React from 'react';

import { TabsView } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import type { ArgsTableProps } from './ArgsTable';
import { ArgsTable } from './ArgsTable';

type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;

export type TabbedArgsTableProps = DistributiveOmit<ArgsTableProps, 'rows'> & {
  tabs: Record<string, ArgsTableProps>;
};

const StyledTabsView = styled(TabsView)({
  height: 'fit-content',
});

export const TabbedArgsTable: FC<TabbedArgsTableProps> = ({ tabs, ...props }) => {
  const entries = Object.entries(tabs);

  if (entries.length === 1) {
    return <ArgsTable {...entries[0][1]} {...props} />;
  }

  const tabsFromEntries = entries.map(([label, table], index) => {
    // The first tab is the main component, controllable if in the Controls block. All other tabs
    // are subcomponents, never controllable, so we filter out the props indicating
    // controllability. Pass a stable element (not an inline function component) so React
    // reconciles the tab panel instead of remounting it on every args update.
    const argsTableProps = index === 0 ? props : { sort: props.sort, docsLang: props.docsLang };

    return {
      id: `prop_table_div_${label}`,
      title: label,
      children: <ArgsTable inTabPanel {...table} {...argsTableProps} />,
    };
  });

  return <StyledTabsView tabs={tabsFromEntries} />;
};
