import type { FC } from 'react';
import React, { useRef } from 'react';

import { ScrollArea } from 'storybook/internal/components';

import { useTabPanel } from 'react-aria';
import type { Node, TabListState } from 'react-stately';
import { styled } from 'storybook/theming';

export interface AriaTabPanelProps {
  /** The state of the tab list. Primary mechanism for using the tabpanel. */
  state: TabListState<object>;

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

export const AriaTabPanel: FC<AriaTabPanelProps> = ({
  hasScrollbar = true,
  renderAllChildren = false,
  state,
  ...rest
}) => {
  const ref = useRef(null);
  const { tabPanelProps } = useTabPanel({}, state, ref);

  const childrenToRender = renderAllChildren
    ? [...state.collection]
    : [state.selectedItem].filter((item): item is Node<object> => !!item);

  return childrenToRender.map((item) => {
    const isSelected = state.selectedKey === item.key;

    return (
      <Panel
        key={item.key}
        ref={isSelected ? ref : undefined}
        {...(isSelected ? rest : {})}
        {...(isSelected ? tabPanelProps : {})}
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
