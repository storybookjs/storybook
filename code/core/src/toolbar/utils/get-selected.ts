import type { ToolbarItem } from '../types';

interface GetSelectedItemProps {
  currentValue: string | null;
  items: ToolbarItem[];
}

export const getSelectedItem = ({ currentValue, items }: GetSelectedItemProps) => {
  const selectedItem =
    currentValue != null &&
    items.find((item) => item.value === currentValue && item.type !== 'reset');
  return selectedItem;
};

export const getSelectedIcon = ({ currentValue, items }: GetSelectedItemProps) => {
  const selectedItem = getSelectedItem({ currentValue, items });
  if (selectedItem) {
    return selectedItem.icon;
  }
  return undefined;
};

export const getSelectedTitle = ({ currentValue, items }: GetSelectedItemProps) => {
  const selectedItem = getSelectedItem({ currentValue, items });
  if (selectedItem) {
    return selectedItem.title;
  }
  return undefined;
};
