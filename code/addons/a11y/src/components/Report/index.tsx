import type { FC } from 'react';
import React, { Fragment } from 'react';
import { EmptyTabContent } from 'storybook/internal/components';
import type { Result } from 'axe-core';

import { Item } from './Item';

import type { RuleType } from '../A11YPanel';

export interface ReportProps {
  items: Result[];
  empty: string;
  type: RuleType;
}

export const Report: FC<ReportProps> = ({ items, empty, type }) => (
  <Fragment>
    {items && items.length ? (
      items.map((item) => <Item item={item} key={`${type}:${item.id}`} type={type} />)
    ) : (
      <EmptyTabContent title={empty} />
    )}
  </Fragment>
);
