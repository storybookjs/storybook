import type { FC } from 'react';
import React from 'react';

import { TabsView } from 'storybook/internal/components';

import type { ArgsTableProps } from './ArgsTable';
import { ArgsTable } from './ArgsTable';

type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;

export type TabbedArgsTableProps = DistributiveOmit<ArgsTableProps, 'rows'> & {
  tabs: Record<string, ArgsTableProps>;
};

export const TabbedArgsTable: FC<TabbedArgsTableProps> = ({ tabs, ...props }) => {
  const entries = Object.entries(tabs);

  if (entries.length === 1) {
    return <ArgsTable {...entries[0][1]} {...props} />;
  }

  const tabsFromEntries = entries.map(([label, table], index) => ({
    id: `prop_table_div_${label}`,
    title: label,
    children: () => {
      /**
       * The first tab is the main component, controllable if in the Controls block All other tabs
       * are subcomponents, never controllable, so we filter out the props indicating
       * controllability Essentially all subcomponents always behave like ArgTypes, never Controls
       */
      const argsTableProps = index === 0 ? props : { sort: props.sort };

      return <ArgsTable inTabPanel key={`prop_table_${label}`} {...table} {...argsTableProps} />;
    },
  }));

  return <TabsView tabs={tabsFromEntries} />;
};
