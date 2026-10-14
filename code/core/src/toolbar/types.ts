import type { Icon } from '@storybook/icons';

import type { InputType } from 'storybook/internal/types';

export type ToolbarShortcutType = 'next' | 'previous' | 'reset';

export type ToolbarItemType = 'item' | 'reset';

export interface ToolbarShortcutConfig {
  label: string;
  keys: string[];
}

export type ToolbarShortcuts = Record<ToolbarShortcutType, ToolbarShortcutConfig>;

/**
 * An icon component individually imported from `@storybook/icons`, e.g. `CircleHollowIcon`.
 * Legacy string icon names are no longer supported.
 */
export type ToolbarIconType = Icon;

export interface ToolbarItem {
  value?: string;
  /** Icon component from `@storybook/icons`, e.g. `import { CircleHollowIcon } from '@storybook/icons'` */
  icon?: ToolbarIconType;
  right?: string;
  title?: string;
  hideIcon?: boolean;
  type?: ToolbarItemType;
}

export interface NormalizedToolbarConfig {
  /** The label to show for this toolbar item */
  title?: string;
  /** Icon component from `@storybook/icons` shown next to the toolbar title */
  icon?: ToolbarIconType;
  /** Set to true to prevent default update of icon to match any present selected items icon */
  preventDynamicIcon?: boolean;
  items: ToolbarItem[];
  shortcuts?: ToolbarShortcuts;
  /** Change title based on selected value */
  dynamicTitle?: boolean;
}

export type NormalizedToolbarArgType = Omit<ToolbarArgType, 'toolbar'> & {
  toolbar: NormalizedToolbarConfig;
};

export type ToolbarConfig = Omit<NormalizedToolbarConfig, 'items'> & {
  items: (string | ToolbarItem)[];
};

export type ToolbarArgType = {
  name?: string;
  description?: string;
  toolbar?: ToolbarConfig;
};

export type ToolbarMenuProps = NormalizedToolbarArgType & { id: string };
