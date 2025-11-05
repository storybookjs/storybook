import type { FC, HTMLAttributes } from 'react';
import React, { useRef } from 'react';

import { useTabPanel } from '@react-aria/tabs';
import type { TabListState } from '@react-stately/tabs';
import type { Node } from '@react-types/shared';
import { styled } from 'storybook/theming';

import { ScrollArea } from '../ScrollArea/ScrollArea';
import type { useTabsState } from './TabsView';

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** The state of the tab list. Primary mechanism for using the tabpanel. */
  state: ReturnType<typeof useTabsState>;

  /**
   * Whether the panel adds a vertical scrollbar. Disable if you want to use fixed or sticky
   * positioning on part of the tab's content. True by default.
   */
  hasScrollbar?: boolean;

  /**
   * Whether to render only the active tab's content, or all tabs. When true, non-selected tabs are
   * rendered with the hidden attribute and do not affect the accessibility object model.
   */
  renderAllChildren?: boolean;
}

const Panel = styled.div({
  overflowY: 'hidden',
  height: '100%',
});

export const TabPanel: FC<TabPanelProps> = ({
  hasScrollbar = true,
  renderAllChildren = false,
  state,
}) => {
  const ref = useRef(null);
  const typedState = state as TabListState<object>;
  const { tabPanelProps } = useTabPanel(typedState.selectedItem ?? {}, typedState, ref);

  const childrenToRender = (
    renderAllChildren ? [...typedState.collection] : [typedState.selectedItem]
  ).filter((item): item is Node<object> => !!item);

  return childrenToRender.map((item) => {
    const isSelected = typedState.selectedKey === item.key;

    return (
      <Panel
        key={item.key}
        ref={isSelected ? ref : undefined}
        {...(isSelected ? tabPanelProps : {})}
        id={isSelected ? `${tabPanelProps.id}`.replace(/null$/, `${item.key}`) : undefined}
        hidden={isSelected ? undefined : true}
      >
        {hasScrollbar ? (
          <ScrollArea vertical>{item.props.children}</ScrollArea>
        ) : (
          item.props.children
        )}
      </Panel>
    );
  });
};
