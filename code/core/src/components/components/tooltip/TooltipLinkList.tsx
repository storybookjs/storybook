import type { SyntheticEvent } from 'react';
import React, { useCallback } from 'react';

import { styled } from '@storybook/core/theming';

import type { LinkWrapperType, ListItemProps } from './ListItem';
import ListItem from './ListItem';

const List = styled.div(
  {
    minWidth: 180,
    overflow: 'hidden',
    overflowY: 'auto',
    maxHeight: 15.5 * 32, // 11.5 items
  },
  ({ theme }) => ({
    borderRadius: theme.appBorderRadius,
  })
);

export interface Link extends Omit<ListItemProps, 'onClick'> {
  id: string;
  isGatsby?: boolean;
  onClick?: (event: SyntheticEvent, item: ListItemProps) => void;
}

interface ItemProps extends Link {
  isIndented?: boolean;
}

const Item = (props: ItemProps) => {
  const { LinkWrapper, onClick: onClickFromProps, id, isIndented, ...rest } = props;
  const { title, href, active } = rest;
  const onClick = useCallback(
    (event: SyntheticEvent) => {
      // @ts-expect-error (non strict)
      onClickFromProps(event, rest);
    },
    [onClickFromProps]
  );

  const hasOnClick = !!onClickFromProps;

  return (
    <ListItem
      title={title}
      active={active}
      href={href}
      id={`list-item-${id}`}
      LinkWrapper={LinkWrapper}
      isIndented={isIndented}
      {...rest}
      {...(hasOnClick ? { onClick } : {})}
    />
  );
};

export interface TooltipLinkListProps {
  links: Link[];
  LinkWrapper?: LinkWrapperType;
}

// @ts-expect-error (non strict)
export const TooltipLinkList = ({ links, LinkWrapper = null }: TooltipLinkListProps) => {
  const hasIcon = links.some((link) => link.icon);
  return (
    <List>
      {links.map(({ isGatsby, ...p }) => (
        // @ts-expect-error (non strict)
        <Item key={p.id} LinkWrapper={isGatsby ? LinkWrapper : null} isIndented={hasIcon} {...p} />
      ))}
    </List>
  );
};
