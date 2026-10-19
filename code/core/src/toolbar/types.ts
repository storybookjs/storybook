import type * as Icons from '@storybook/icons';

import type { InputType } from 'storybook/internal/types';

export type ToolbarShortcutType = 'next' | 'previous' | 'reset';

export type ToolbarItemType = 'item' | 'reset';

export interface ToolbarShortcutConfig {
  label: string;
  keys: string[];
}

export type ToolbarShortcuts = Record<ToolbarShortcutType, ToolbarShortcutConfig>;

/**
 * The names of the icon components exported by `@storybook/icons`, e.g. `'CircleHollowIcon'`.
 *
 * The manager resolves the name against the package's exports and renders the matching icon;
 * a name the package does not export renders no icon.
 */
export type ToolbarIconType = {
  [K in keyof typeof Icons]: K extends `${string}Icon` ? K : never;
}[keyof typeof Icons];

export interface ToolbarItem {
  value?: string;
  /** Name of an icon exported by `@storybook/icons`, e.g. `'CircleHollowIcon'` */
  icon?: ToolbarIconType;
  right?: string;
  title?: string;
  hideIcon?: boolean;
  type?: ToolbarItemType;
}

export interface NormalizedToolbarConfig {
  /** The label to show for this toolbar item */
  title?: string;
  /** Name of an icon exported by `@storybook/icons`, e.g. `'CircleHollowIcon'` */
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
