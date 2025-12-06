import { type API } from 'storybook/manager-api';

import { ADDON_ID } from './constants';
import type { useViewport } from './useViewport';

const getCurrentViewportIndex = (viewportsKeys: string[], current: string): number =>
  viewportsKeys.indexOf(current);

const getNextViewport = (viewportsKeys: string[], current: string): string => {
  const currentViewportIndex = getCurrentViewportIndex(viewportsKeys, current);
  return currentViewportIndex === viewportsKeys.length - 1
    ? viewportsKeys[0]
    : viewportsKeys[currentViewportIndex + 1];
};

const getPreviousViewport = (viewportsKeys: string[], current: string): string => {
  const currentViewportIndex = getCurrentViewportIndex(viewportsKeys, current);
  return currentViewportIndex < 1
    ? viewportsKeys[viewportsKeys.length - 1]
    : viewportsKeys[currentViewportIndex - 1];
};

export const registerShortcuts = async (api: API, viewport: ReturnType<typeof useViewport>) => {
  const viewportKeys = Object.keys(viewport.options);

  await api.setAddonShortcut(ADDON_ID, {
    label: 'Previous viewport',
    defaultShortcut: ['alt', 'shift', 'V'],
    actionName: 'previous',
    action: () => {
      viewport.update({ value: getPreviousViewport(viewportKeys, viewport.key) });
    },
  });

  await api.setAddonShortcut(ADDON_ID, {
    label: 'Next viewport',
    defaultShortcut: ['alt', 'V'],
    actionName: 'next',
    action: () => {
      viewport.update({ value: getNextViewport(viewportKeys, viewport.key) });
    },
  });

  await api.setAddonShortcut(ADDON_ID, {
    label: 'Reset viewport',
    defaultShortcut: ['alt', 'control', 'V'],
    actionName: 'reset',
    action: () => {
      viewport.update({ value: undefined, isRotated: false });
    },
  });
};
