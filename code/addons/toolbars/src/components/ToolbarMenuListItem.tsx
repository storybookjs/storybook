import React from 'react';
import type { TooltipLinkListLink } from 'storybook/internal/components';
import { Icons } from 'storybook/internal/components';
import type { ToolbarItem } from '../types';

export type ToolbarMenuListItemProps = {
  currentValue: string;
  onClick: () => void;
} & ToolbarItem;

export const ToolbarMenuListItem = ({
  right,
  title,
  value,
  icon,
  hideIcon,
  onClick,
  currentValue,
}: ToolbarMenuListItemProps) => {
  const Icon = icon && <Icons style={{ opacity: 1 }} icon={icon} />;

  const Item: TooltipLinkListLink = {
    id: value ?? '_reset',
    active: currentValue === value,
    right,
    title,
    icon,
    onClick,
  };

  if (icon && !hideIcon) {
    Item.icon = Icon;
  }

  return Item;
};
