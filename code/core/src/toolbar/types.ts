import type { InputType } from 'storybook/internal/types';

export type ToolbarShortcutType = 'next' | 'previous' | 'reset';

export type ToolbarItemType = 'item' | 'reset';

export interface ToolbarShortcutConfig {
  label: string;
  keys: string[];
}

export type ToolbarShortcuts = Record<ToolbarShortcutType, ToolbarShortcutConfig>;

/**
 * Legacy string icon name from the removed `Icons` component.
 *
 * String icon names no longer render: icons must be provided as a React node. Toolbar menus
 * relying on `icon` should set a `title` so they remain usable.
 * @deprecated Remove in a future major; see https://github.com/storybookjs/storybook/issues/29159
 */
export type ToolbarIconName = string;

export interface ToolbarItem {
  value?: string;
  /**
   * No longer renders; string icon names were removed with the `Icons` component.
   * @deprecated
   */
  icon?: ToolbarIconName;
  right?: string;
  title?: string;
  hideIcon?: boolean;
  type?: ToolbarItemType;
}

export interface NormalizedToolbarConfig {
  /** The label to show for this toolbar item */
  title?: string;
  /** No longer renders; the `Icons`/`Symbols` components were removed in Storybook 11. */
  icon?: ToolbarIconName;
  /** Set to true to prevent default update of icon to match any present selected items icon */
  preventDynamicIcon?: boolean;
  items: ToolbarItem[];
  shortcuts?: ToolbarShortcuts;
  /** Change title based on selected value */
  dynamicTitle?: boolean;
}

export type NormalizedToolbarArgType = {
  name: string;
  description: string;
  defaultValue?: any;
  toolbar: NormalizedToolbarConfig;
};

export type ToolbarConfig = Omit<NormalizedToolbarConfig, 'items'> & {
  items: (string | ToolbarItem)[];
};

export type ToolbarArgType = {
  name?: string;
  description?: string;
  defaultValue?: any;
  toolbar?: ToolbarConfig;
  /**
   * @deprecated This loose index signature has been added for compatibility with InputType, and
   *   will be removed in Storybook 11
   */
  [key: string]: any;
};

export type ToolbarMenuProps = NormalizedToolbarArgType & { id: string };
