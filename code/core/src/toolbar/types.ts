import type { InputType } from 'storybook/internal/types';

import type { toolbarIcons } from './components/ToolbarIcon.tsx';

export type ToolbarShortcutType = 'next' | 'previous' | 'reset';

export type ToolbarItemType = 'item' | 'reset';

export interface ToolbarShortcutConfig {
  label: string;
  keys: string[];
}

export type ToolbarShortcuts = Record<ToolbarShortcutType, ToolbarShortcutConfig>;

export interface ToolbarItem {
  value?: string;
  icon?: keyof typeof toolbarIcons;
  right?: string;
  title?: string;
  hideIcon?: boolean;
  type?: ToolbarItemType;
}

export interface NormalizedToolbarConfig {
  /** The label to show for this toolbar item */
  title?: string;
  /** Choose an icon to show for this toolbar item */
  icon?: keyof typeof toolbarIcons;
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
