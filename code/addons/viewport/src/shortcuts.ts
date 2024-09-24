import { type API } from 'storybook/internal/manager-api';

import { ADDON_ID } from './constants';
import { initialGlobals as defaultGlobals } from './preview';

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

export const registerShortcuts = async (
  api: API,
  viewport: any,
  updateGlobals: any,
  viewportsKeys: string[]
) => {
  await api.setAddonShortcut(ADDON_ID, {
    label: 'Previous viewport',
    defaultShortcut: ['alt', 'shift', 'V'],
    actionName: 'previous',
    action: () => {
      updateGlobals({
        viewport: getPreviousViewport(viewportsKeys, viewport),
      });
    },
  });

  await api.setAddonShortcut(ADDON_ID, {
    label: 'Next viewport',
    defaultShortcut: ['alt', 'V'],
    actionName: 'next',
    action: () => {
      updateGlobals({
        viewport: getNextViewport(viewportsKeys, viewport),
      });
    },
  });

  await api.setAddonShortcut(ADDON_ID, {
    label: 'Reset viewport',
    defaultShortcut: ['alt', 'control', 'V'],
    actionName: 'reset',
    action: () => {
      updateGlobals(defaultGlobals);
    },
  });
};
