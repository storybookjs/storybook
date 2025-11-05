import type { FC, ReactNode } from 'react';
import React from 'react';

import { TabPanel } from 'react-aria-components/patched-dist/Tabs';
import { styled } from 'storybook/theming';

import { ScrollArea } from '../ScrollArea/ScrollArea';

export interface StatelessTabPanelProps {
  /** Content of the tab panel. */
  children: ReactNode;

  /** Unique id of the TabPanel, must match that of its corresponding Tab. */
  name: string;

  /**
   * Whether the panel adds a vertical scrollbar. Disable if you want to use fixed or sticky
   * positioning on part of the tab's content. True by default.
   */
  hasScrollbar?: boolean;
}

const Root = styled(TabPanel)({
  overflowY: 'hidden',
  height: '100%',
  display: 'block',
  ['&[inert="true"]']: { display: 'none' },
});

export const StatelessTabPanel: FC<StatelessTabPanelProps> = ({
  children,
  hasScrollbar = true,
  name,
  ...rest
}) => {
  return (
    <Root {...rest} shouldForceMount id={name}>
      {hasScrollbar ? <ScrollArea vertical>{children}</ScrollArea> : children}
    </Root>
  );
};
