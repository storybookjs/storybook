import { getStoryHref } from 'storybook/internal/components';
import {
  FORCE_REMOUNT,
  PREVIEW_KEYDOWN,
  STORIES_COLLAPSE_ALL,
  STORIES_EXPAND_ALL,
} from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import copy from 'copy-to-clipboard';

import type { KeyboardEventLike } from '../lib/shortcut';
import { eventToShortcut, shortcutMatchesShortcut } from '../lib/shortcut';
import type { ModuleFn } from '../lib/types';
import { focusableUIElements } from './layout';

const { navigator, document, PREVIEW_URL } = global;

export const isMacLike = () =>
  navigator && navigator.platform ? !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) : false;
export const controlOrMetaKey = () => (isMacLike() ? 'meta' : 'control');

export function keys<O>(o: O) {
  return Object.keys(o!) as (keyof O)[];
}

export interface SubState {
  shortcuts: API_Shortcuts;
}

export interface SubAPI {
  /** Returns the current shortcuts. */
  getShortcutKeys(): API_Shortcuts;
  /** Returns the default shortcuts. */
  getDefaultShortcuts(): API_Shortcuts | API_AddonShortcutDefaults;
  /** Returns the shortcuts for addons. */
  getAddonsShortcuts(): API_AddonShortcuts;
  /** Returns the labels for addon shortcuts. */
  getAddonsShortcutLabels(): API_AddonShortcutLabels;
  /** Returns the default shortcuts for addons. */
  getAddonsShortcutDefaults(): API_AddonShortcutDefaults;
  /**
   * Sets the shortcuts to the given value.
   *
   * @param shortcuts The new shortcuts to set.
   * @returns A promise that resolves to the new shortcuts.
   */
  setShortcuts(shortcuts: API_Shortcuts): Promise<API_Shortcuts>;
  /**
   * Sets the shortcut for the given action to the given value.
   *
   * @param action The action to set the shortcut for.
   * @param value The new shortcut to set.
   * @returns A promise that resolves to the new shortcut.
   */
  setShortcut(action: API_Action, value: API_KeyCollection): Promise<API_KeyCollection>;
  /**
   * Sets the shortcut for the given addon to the given value.
   *
   * @param addon The addon to set the shortcut for.
   * @param shortcut The new shortcut to set.
   * @returns A promise that resolves to the new addon shortcut.
   */
  setAddonShortcut(addon: string, shortcut: API_AddonShortcut): Promise<API_AddonShortcut>;
  /**
   * Restores all default shortcuts.
   *
   * @returns A promise that resolves to the new shortcuts.
   */
  restoreAllDefaultShortcuts(): Promise<API_Shortcuts>;
  /**
   * Restores the default shortcut for the given action.
   *
   * @param action The action to restore the default shortcut for.
   * @returns A promise that resolves to the new shortcut.
   */
  restoreDefaultShortcut(action: API_Action): Promise<API_KeyCollection>;
  /**
   * Handles a keydown event.
   *
   * @param event The event to handle.
   */
  handleKeydownEvent(event: KeyboardEventLike): void;
  /**
   * Handles a shortcut feature.
   *
   * @param feature The feature to handle.
   * @param event The event to handle.
   */
  handleShortcutFeature(feature: API_Action, event: KeyboardEventLike): void;
}

export type API_KeyCollection = string[];

export interface API_Shortcuts {
  fullScreen: API_KeyCollection;
  togglePanel: API_KeyCollection;
  panelPosition: API_KeyCollection;
  toggleNav: API_KeyCollection;
  toolbar: API_KeyCollection;
  search: API_KeyCollection;
  focusNav: API_KeyCollection;
  focusIframe: API_KeyCollection;
  focusPanel: API_KeyCollection;
  prevComponent: API_KeyCollection;
  nextComponent: API_KeyCollection;
  prevStory: API_KeyCollection;
  nextStory: API_KeyCollection;
  shortcutsPage: API_KeyCollection;
  aboutPage: API_KeyCollection;
  escape: API_KeyCollection;
  collapseAll: API_KeyCollection;
  expandAll: API_KeyCollection;
  remount: API_KeyCollection;
  openInEditor: API_KeyCollection;
  copyStoryLink: API_KeyCollection;
  openInIsolation: API_KeyCollection;
  // TODO: bring this back once we want to add shortcuts for this
  // copyStoryName: API_KeyCollection;
}

export type API_Action = keyof API_Shortcuts;

interface API_AddonShortcut {
  label: string;
  defaultShortcut: API_KeyCollection;
  actionName: string;
  showInMenu?: boolean;
  action: (...args: any[]) => any;
}
type API_AddonShortcuts = Record<string, API_AddonShortcut>;
type API_AddonShortcutLabels = Record<string, string>;
type API_AddonShortcutDefaults = Record<string, API_KeyCollection>;

export const defaultShortcuts: API_Shortcuts = Object.freeze({
  fullScreen: ['alt', 'F'],
  togglePanel: ['alt', 'A'],
  panelPosition: ['alt', 'D'],
  toggleNav: ['alt', 'S'],
  toolbar: ['alt', 'T'],
  search: [controlOrMetaKey(), 'K'],
  focusNav: ['1'],
  focusIframe: ['2'],
  focusPanel: ['3'],
  prevComponent: ['alt', 'ArrowUp'],
  nextComponent: ['alt', 'ArrowDown'],
  prevStory: ['alt', 'ArrowLeft'],
  nextStory: ['alt', 'ArrowRight'],
  shortcutsPage: [controlOrMetaKey(), 'shift', ','],
  aboutPage: [controlOrMetaKey(), ','],
  escape: ['escape'], // This one is not customizable
  collapseAll: [controlOrMetaKey(), 'shift', 'ArrowUp'],
  expandAll: [controlOrMetaKey(), 'shift', 'ArrowDown'],
  remount: ['alt', 'R'],
  openInEditor: ['alt', 'shift', 'E'],
  copyStoryLink: ['alt', 'shift', 'L'],
  openInIsolation: ['alt', 'shift', 'I'],
  // TODO: bring this back once we want to add shortcuts for this
  // copyStoryName: ['alt', 'shift', 'C'],
});

const addonsShortcuts: API_AddonShortcuts = {};

function shouldSkipShortcut(event: KeyboardEvent) {
  const target = event.target as Element;
  if (/input|textarea/i.test(target.tagName) || target.getAttribute('contenteditable') !== null) {
    return true;
  }
  const dialogElement = target.closest('dialog[open]');
  if (dialogElement) {
    return true;
  }

  return false;
}

export const init: ModuleFn = ({ store, fullAPI, provider }) => {
  const api: SubAPI = {
    // Getting and setting shortcuts
    getShortcutKeys(): API_Shortcuts {
      return store.getState().shortcuts;
    },
    getDefaultShortcuts(): API_Shortcuts | API_AddonShortcutDefaults {
      return {
        ...defaultShortcuts,
        ...api.getAddonsShortcutDefaults(),
      };
    },
    getAddonsShortcuts(): API_AddonShortcuts {
      return addonsShortcuts;
    },
    getAddonsShortcutLabels(): API_AddonShortcutLabels {
      const labels: API_AddonShortcutLabels = {};
      Object.entries(api.getAddonsShortcuts()).forEach(([actionName, { label }]) => {
        labels[actionName] = label;
      });

      return labels;
    },
    getAddonsShortcutDefaults(): API_AddonShortcutDefaults {
      const defaults: API_AddonShortcutDefaults = {};
      Object.entries(api.getAddonsShortcuts()).forEach(([actionName, { defaultShortcut }]) => {
        defaults[actionName] = defaultShortcut;
      });

      return defaults;
    },
    async setShortcuts(shortcuts: API_Shortcuts) {
      await store.setState({ shortcuts }, { persistence: 'permanent' });
      return shortcuts;
    },
    async restoreAllDefaultShortcuts() {
      return api.setShortcuts(api.getDefaultShortcuts() as API_Shortcuts);
    },
    async setShortcut(action, value) {
      const shortcuts = api.getShortcutKeys();
      await api.setShortcuts({ ...shortcuts, [action]: value });
      return value;
    },
    async setAddonShortcut(addon: string, shortcut: API_AddonShortcut) {
      const shortcuts = api.getShortcutKeys();
      await api.setShortcuts({
        ...shortcuts,
        [`${addon}-${shortcut.actionName}`]: shortcut.defaultShortcut,
      });
      addonsShortcuts[`${addon}-${shortcut.actionName}`] = shortcut;
      return shortcut;
    },
    async restoreDefaultShortcut(action) {
      const defaultShortcut = api.getDefaultShortcuts()[action];
      return api.setShortcut(action, defaultShortcut);
    },

    // Listening to shortcut events
    handleKeydownEvent(event) {
      const shortcut = eventToShortcut(event);
      const shortcuts = api.getShortcutKeys();
      const actions = keys(shortcuts);
      const matchedFeature = actions.find((feature: API_Action) =>
        shortcutMatchesShortcut(shortcut!, shortcuts[feature])
      );
      if (matchedFeature) {
        api.handleShortcutFeature(matchedFeature, event);
      }
    },

    // warning: event might not have a full prototype chain because it may originate from the channel
    handleShortcutFeature(feature, event) {
      const {
        ui: { enableShortcuts },
        storyId,
        refId,
        refs,
        customQueryParams,
      } = store.getState();
      if (!enableShortcuts) {
        return;
      }

      // Event.prototype.preventDefault is missing when received from the MessageChannel.
      if (event?.preventDefault) {
        event.preventDefault();
      }
      switch (feature) {
        case 'escape': {
          if (fullAPI.getIsFullscreen()) {
            fullAPI.toggleFullscreen(false);
          } else if (fullAPI.getIsNavShown()) {
            fullAPI.toggleNav(true);
          }
          break;
        }

        case 'focusNav': {
          if (fullAPI.getIsFullscreen()) {
            fullAPI.toggleFullscreen(false);
          }
          if (!fullAPI.getIsNavShown()) {
            fullAPI.toggleNav(true);
          }
          fullAPI.focusOnUIElement(focusableUIElements.storyListMenu);
          break;
        }

        case 'search': {
          if (fullAPI.getIsFullscreen()) {
            fullAPI.toggleFullscreen(false);
          }
          if (!fullAPI.getIsNavShown()) {
            fullAPI.toggleNav(true);
          }

          setTimeout(() => {
            fullAPI.focusOnUIElement(focusableUIElements.storySearchField, true);
          }, 0);
          break;
        }

        case 'focusIframe': {
          const element = document.getElementById('storybook-preview-iframe') as HTMLIFrameElement;

          if (element) {
            try {
              // should be like a channel message and all that, but yolo for now
              element.contentWindow!.focus();
            } catch (e) {
              //
            }
          }
          break;
        }

        case 'focusPanel': {
          if (fullAPI.getIsFullscreen()) {
            fullAPI.toggleFullscreen(false);
          }
          if (!fullAPI.getIsPanelShown()) {
            fullAPI.togglePanel(true);
          }
          fullAPI.focusOnUIElement(focusableUIElements.storyPanelRoot);
          break;
        }

        case 'nextStory': {
          fullAPI.jumpToStory(1);
          break;
        }

        case 'prevStory': {
          fullAPI.jumpToStory(-1);
          break;
        }

        case 'nextComponent': {
          fullAPI.jumpToComponent(1);
          break;
        }

        case 'prevComponent': {
          fullAPI.jumpToComponent(-1);
          break;
        }

        case 'fullScreen': {
          fullAPI.toggleFullscreen();
          break;
        }

        case 'togglePanel': {
          fullAPI.togglePanel();
          break;
        }

        case 'toggleNav': {
          fullAPI.toggleNav();
          break;
        }

        case 'toolbar': {
          fullAPI.toggleToolbar();
          break;
        }

        case 'panelPosition': {
          if (fullAPI.getIsFullscreen()) {
            fullAPI.toggleFullscreen(false);
          }
          if (!fullAPI.getIsPanelShown()) {
            fullAPI.togglePanel(true);
          }

          fullAPI.togglePanelPosition();
          break;
        }

        case 'aboutPage': {
          fullAPI.navigate('/settings/about');
          break;
        }

        case 'shortcutsPage': {
          fullAPI.navigate('/settings/shortcuts');
          break;
        }
        case 'collapseAll': {
          fullAPI.emit(STORIES_COLLAPSE_ALL);
          break;
        }
        case 'expandAll': {
          fullAPI.emit(STORIES_EXPAND_ALL);
          break;
        }
        case 'remount': {
          fullAPI.emit(FORCE_REMOUNT, { storyId });
          break;
        }
        case 'openInEditor': {
          if (global.CONFIG_TYPE === 'DEVELOPMENT') {
            fullAPI.openInEditor({
              file: fullAPI.getCurrentStoryData().importPath,
            });
          }
          break;
        }
        case 'openInIsolation': {
          const { location } = document;
          // @ts-expect-error (non strict)
          const ref = refs[refId];
          let baseUrl = `${location.origin}${location.pathname}`;

          if (!baseUrl.endsWith('/')) {
            baseUrl += '/';
          }

          const href = getStoryHref(
            ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || `${baseUrl}iframe.html`,
            storyId,
            Object.fromEntries(
              Object.entries(customQueryParams).filter(([, value]) => value !== undefined)
            ) as Record<string, string>
          );
          window.open(href, '_blank', 'noopener,noreferrer');
          break;
        }
        // TODO: bring this back once we want to add shortcuts for this
        // case 'copyStoryName': {
        //   const storyData = fullAPI.getCurrentStoryData();
        //   if (storyData.type === 'story') {
        //     copy(storyData.exportName);
        //   }
        //   break;
        // }
        case 'copyStoryLink': {
          copy(window.location.href);
          break;
        }
        default:
          addonsShortcuts[feature].action();
          break;
      }
    },
  };

  const { shortcuts: persistedShortcuts = defaultShortcuts }: SubState = store.getState();
  const state: SubState = {
    // Any saved shortcuts that are still in our set of defaults
    shortcuts: keys(defaultShortcuts).reduce(
      (acc, key) => ({ ...acc, [key]: persistedShortcuts[key] || defaultShortcuts[key] }),
      defaultShortcuts
    ),
  };

  const initModule = () => {
    // Listen for keydown events in the manager
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!shouldSkipShortcut(event)) {
        api.handleKeydownEvent(event);
      }
    });

    // Also listen to keydown events sent over the channel
    provider.channel?.on(PREVIEW_KEYDOWN, (data: { event: KeyboardEventLike }) => {
      api.handleKeydownEvent(data.event);
    });
  };

  return { api, state, init: initModule };
};
