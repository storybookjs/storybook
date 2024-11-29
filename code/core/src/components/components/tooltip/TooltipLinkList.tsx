import type { ComponentProps, ReactNode, SyntheticEvent } from 'react';
import React, { Fragment, useCallback } from 'react';

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
  }),
  ({ theme }) => (theme.base === 'dark' ? { background: theme.background.content } : {})
);

const Group = styled.div(({ theme }) => ({
  padding: 4,
  '& + &': {
    borderTop: `1px solid ${theme.appBorderColor}`,
  },
}));

export interface NormalLink extends Omit<ListItemProps, 'onClick'> {
  id: string;
  onClick?: (
    event: SyntheticEvent,
    item: Pick<ListItemProps, 'id' | 'active' | 'disabled' | 'title' | 'href'>
  ) => void;
}

export type Link = CustomLink | NormalLink;

/**
 * This is a custom link that can be used in the `TooltipLinkList` component. It allows for custom
 * content to be rendered in the list; it does not have to be a link.
 */
interface CustomLink {
  id: string;
  content: ReactNode;
}

interface ItemProps extends NormalLink {
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
  const isIndented = groups.some((group) => group.some((link) => 'icon' in link && link.icon));
  return (
    <List {...props}>
      {groups
        .filter((group) => group.length)
        .map((group, index) => {
          return (
            <Group key={group.map((link) => link.id).join(`~${index}~`)}>
              {group.map((link) => {
                if ('content' in link) {
                  return <Fragment key={link.id}>{link.content}</Fragment>;
                }
                return (
                  <Item key={link.id} isIndented={isIndented} LinkWrapper={LinkWrapper} {...link} />
                );
              })}
            </Group>
          );
        })}
    </List>
  );
};
