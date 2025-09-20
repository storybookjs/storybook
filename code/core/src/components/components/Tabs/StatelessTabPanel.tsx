import type { FC, ReactNode } from 'react';
import React from 'react';

import { ScrollArea } from 'storybook/internal/components';

import { TabPanel, type TabPanelProps } from 'react-aria-components';
import { styled } from 'storybook/theming';

export interface StatelessTabPanelProps extends TabPanelProps {
  /** Content of the tab panel. */
  children: ReactNode;

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
  ...rest
}) => {
  return (
    <Root {...rest} shouldForceMount>
      {hasScrollbar ? <ScrollArea vertical>{children}</ScrollArea> : children}
    </Root>
  );
};
