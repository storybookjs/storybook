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
    maxHeight: 15.5 * 32 + 8, // 15.5 items at 32px each + 8px padding
  },
  ({ theme }) => ({
    borderRadius: theme.appBorderRadius + 2,
  })
);

const Group = styled.div(({ theme }) => ({
  padding: 4,
  '& + &': {
    borderTop: `1px solid ${theme.appBorderColor}`,
  },
}));

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
  links: Link[] | Link[][];
  LinkWrapper?: LinkWrapperType;
}

export const TooltipLinkList = ({ links, LinkWrapper, ...props }: TooltipLinkListProps) => {
  const groups = Array.isArray(links[0]) ? (links as Link[][]) : [links as Link[]];
  const isIndented = groups.some((group) => group.some((link) => link.icon));
  return (
    <List {...props}>
      {groups
        .filter((group) => group.length)
        .map((group, index) => {
          return (
            <Group key={group.map((link) => link.id).join(`~${index}~`)}>
              {group.map((link) => (
                <Item key={link.id} isIndented={isIndented} LinkWrapper={LinkWrapper} {...link} />
              ))}
            </Group>
          );
        })}
    </List>
  );
};
