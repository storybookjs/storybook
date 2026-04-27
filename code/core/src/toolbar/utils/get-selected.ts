import type { ToolbarItem } from '../types.ts';

interface GetSelectedItemProps {
  currentValue: string | null;
  items: ToolbarItem[];
}

export const getSelectedItem = ({ currentValue, items }: GetSelectedItemProps) => {
  return items.find((item) => item.value === currentValue && item.type !== 'reset');
};
