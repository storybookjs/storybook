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
 * The name is serialized from the preview to the manager, where the manager-side `ToolbarIcon`
 * component resolves it to a component. The namespace import is type-only, so the icons package
 * (and with it React) is never bundled into the preview.
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
  /** Name of an `@storybook/icons` icon shown next to the toolbar title */
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
