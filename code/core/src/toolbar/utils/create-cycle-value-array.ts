import type { ToolbarItem, ToolbarItemType } from '../types';

const disallowedCycleableItemTypes: Array<ToolbarItemType> = ['reset'];

export const createCycleValueArray = (items: ToolbarItem[]) => {
  // Do not allow items in the cycle arrays that are conditional in placement
  const valueArray = items
    .filter((item) => !disallowedCycleableItemTypes.includes(item.type as ToolbarItemType))
    .map((item) => item.value);
  return valueArray;
};
