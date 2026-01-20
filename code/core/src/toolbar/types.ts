import type { InputType } from 'storybook/internal/types';

import type { IconsProps } from '../components/components/icon/icon';

export type ToolbarShortcutType = 'next' | 'previous' | 'reset';

export type ToolbarItemType = 'item' | 'reset';

export interface ToolbarShortcutConfig {
  label: string;
  keys: string[];
}

export type ToolbarShortcuts = Record<ToolbarShortcutType, ToolbarShortcutConfig>;

export interface ToolbarItem {
  value?: string;
  icon?: IconsProps['icon'];
  right?: string;
  title?: string;
  hideIcon?: boolean;
  type?: ToolbarItemType;
}

export interface NormalizedToolbarConfig {
  /** The label to show for this toolbar item */
  title?: string;
  /** Choose an icon to show for this toolbar item */
  icon?: IconsProps['icon'];
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
