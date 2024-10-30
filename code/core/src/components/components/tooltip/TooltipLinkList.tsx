import type { ComponentProps, SyntheticEvent } from 'react';
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
  onClick?: (
    event: SyntheticEvent,
    item: Pick<ListItemProps, 'id' | 'active' | 'disabled' | 'title' | 'href'>
  ) => void;
}

interface ItemProps extends Link {
  isIndented?: boolean;
}

const Item = ({ id, onClick, ...rest }: ItemProps) => {
  const { active, disabled, title, href } = rest;

  const handleClick = useCallback(
    (event: SyntheticEvent) => onClick?.(event, { id, active, disabled, title, href }),
    [onClick, id, active, disabled, title, href]
  );

  return <ListItem id={`list-item-${id}`} {...rest} {...(onClick && { onClick: handleClick })} />;
};

export interface TooltipLinkListProps extends ComponentProps<typeof List> {
  links: Link[];
  LinkWrapper?: LinkWrapperType;
}

export const TooltipLinkList = ({ links, LinkWrapper, ...props }: TooltipLinkListProps) => {
  const isIndented = links.some((link) => link.icon);
  return (
    <List {...props}>
      {links.map((link) => (
        <Item key={link.id} isIndented={isIndented} LinkWrapper={LinkWrapper} {...link} />
      ))}
    </List>
  );
};
