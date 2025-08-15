import type { FC } from 'react';
import React, { useRef } from 'react';

import { useTab, useTabList } from 'react-aria';
import type { Node, TabListState } from 'react-stately';
import { styled } from 'storybook/theming';

export interface AriaTabListProps {
  state: TabListState<object>;
}

export const TabButton = styled.button<{
  isDisabled: boolean;
  isPressed: boolean;
  isSelected: boolean;
  textColor?: string;
}>(
  {
    whiteSpace: 'normal',
    display: 'inline-flex',
    overflow: 'hidden',
    verticalAlign: 'top',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    textDecoration: 'none',

    '&:empty': {
      display: 'none',
    },
    '&[hidden]': {
      display: 'none',
    },
  },
  ({ theme }) => ({
    padding: '0 15px',
    transition: 'color 0.2s linear, border-bottom-color 0.2s linear',
    height: 40,
    lineHeight: '12px',
    cursor: 'pointer',
    background: 'transparent',
    border: '0 solid transparent',
    borderTop: '3px solid transparent',
    borderBottom: '3px solid transparent',
    fontWeight: 'bold',
    fontSize: 13,

    '&:focus-visible': {
      outline: '0 none',
      boxShadow: `inset 0 0 0 2px ${theme.barSelectedColor}`,
    },
  }),
  ({ isSelected, textColor, theme }) =>
    isSelected
      ? {
          color: textColor || theme.barSelectedColor,
          borderBottomColor: theme.barSelectedColor,
        }
      : {
          color: textColor || theme.barTextColor,
          borderBottomColor: 'transparent',
          '&:hover': {
            color: theme.barHoverColor,
          },
        }
);

const TabList = styled.div({
  flexShrink: 0,
});

interface AriaTabButtonProps {
  item: Node<object>;
  state: TabListState<object>;
}

const AriaTabButton: FC<AriaTabButtonProps> = ({ item, state }) => {
  const { key, rendered } = item;
  const tabRef = React.useRef(null);
  const { tabProps, isDisabled, isPressed, isSelected } = useTab({ key }, state, tabRef);

  return (
    <TabButton
      {...tabProps}
      isDisabled={isDisabled}
      isPressed={isPressed}
      isSelected={isSelected}
      className={`tabbutton ${isSelected ? 'tabbutton-active' : ''}`}
      ref={tabRef}
    >
      {rendered}
    </TabButton>
  );
};

export interface AriaTabListProps {
  state: TabListState<object>;
}

export const AriaTabList: FC<AriaTabListProps> = ({ state, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList({ orientation: 'horizontal' }, state, ref);

  return (
    <TabList {...rest} ref={ref} {...tabListProps}>
      {[...state.collection].map((item) => (
        <AriaTabButton key={item.key} item={item} state={state} />
      ))}
    </TabList>
  );
};
