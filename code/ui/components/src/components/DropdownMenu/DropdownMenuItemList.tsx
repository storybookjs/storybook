import type { FC } from 'react';
import React from 'react';
import type { DropdownMenuItemProps } from './DropdownMenu';
import { DropdownMenu } from './DropdownMenu';

type ItemProps = DropdownMenuItemProps & {
  withBottomSeparator?: boolean;
};

export type DropdownMenuItemListProps = {
  items: ItemProps[];
};

export const DropdownMenuItemList: FC<DropdownMenuItemListProps> = ({ items }) => {
  return (
    <DropdownMenu.Content sideOffset={5}>
      {items.map(({ withBottomSeparator, ...item }) => (
        <React.Fragment key={item.label}>
          <DropdownMenu.Item {...item} />
          {withBottomSeparator ? <DropdownMenu.Separator /> : null}
        </React.Fragment>
      ))}
    </DropdownMenu.Content>
  );
};
