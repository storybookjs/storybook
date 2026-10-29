import type { NormalizedToolbarArgType, ToolbarArgType } from '../types.ts';

export const normalizeArgType = (
  key: string,
  argType: ToolbarArgType
): NormalizedToolbarArgType | null => {
  const toolbar = argType.toolbar;
  if (!toolbar) {
    return null;
  }
  return {
    ...argType,
    toolbar: {
      ...argType.toolbar,
      items: toolbar.items.map((_item) => {
        const item = typeof _item === 'string' ? { value: _item, title: _item } : _item;

        // Cater for the special type "reset" which will reset value and also icon
        // of toolbar button if any icon was present on toolbar to begin with
        if (item.type === 'reset' && toolbar.icon) {
          item.icon = toolbar.icon;
          item.hideIcon = true;
          item.value = undefined;
        }

        return item;
      }),
    },
  };
};
