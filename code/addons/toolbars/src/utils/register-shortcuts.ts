import type { API } from 'storybook/internal/manager-api';
import { ADDON_ID } from '../constants';
import type { ToolbarShortcutConfig } from '../types';

interface Shortcuts {
  next: ToolbarShortcutConfig & { action: () => void };
  previous: ToolbarShortcutConfig & { action: () => void };
  reset: ToolbarShortcutConfig & { action: () => void };
}

export const registerShortcuts = async (api: API, id: string, shortcuts: Shortcuts) => {
  if (shortcuts && shortcuts.next) {
    await api.setAddonShortcut(ADDON_ID, {
      label: shortcuts.next.label,
      defaultShortcut: shortcuts.next.keys,
      actionName: `${id}:next`,
      action: shortcuts.next.action,
    });
  }

  if (shortcuts && shortcuts.previous) {
    await api.setAddonShortcut(ADDON_ID, {
      label: shortcuts.previous.label,
      defaultShortcut: shortcuts.previous.keys,
      actionName: `${id}:previous`,
      action: shortcuts.previous.action,
    });
  }

  if (shortcuts && shortcuts.reset) {
    await api.setAddonShortcut(ADDON_ID, {
      label: shortcuts.reset.label,
      defaultShortcut: shortcuts.reset.keys,
      actionName: `${id}:reset`,
      action: shortcuts.reset.action,
    });
  }
};
