import type { API_Settings, StoryId } from '@storybook/core/types';
import type { ModuleFn } from '../lib/types';

export interface SubAPI {
  storeSelection: () => void;
  retrieveSelection: () => StoryId;
  /**
   * Changes the active settings tab.
   * @param path - The path of the settings page to navigate to. The path NOT should include the `/settings` prefix.
   * @example  changeSettingsTab(`about`).
   */
  changeSettingsTab: (path: string) => void;
  /**
   * Closes the settings screen and returns to the last tracked story or the first story.
   */
  closeSettings: () => void;
  /**
   * Checks if the settings screen is currently active.
   * @returns A boolean indicating whether the settings screen is active.
   */
  isSettingsScreenActive: () => boolean;
}

export interface SubState {
  settings: API_Settings;
}

export const init: ModuleFn<SubAPI, SubState> = ({ store, navigate, fullAPI }): any => {
  const isSettingsScreenActive = () => {
    const { path } = fullAPI.getUrlState();
    return !!(path || '').match(/^\/settings/);
  };
  const api: SubAPI = {
    closeSettings: () => {
      const {
        settings: { lastTrackedStoryId },
      } = store.getState();

      if (lastTrackedStoryId) {
        fullAPI.selectStory(lastTrackedStoryId);
      } else {
        fullAPI.selectFirstStory();
      }
    },
    changeSettingsTab: (path: string) => {
      navigate(`/settings/${path}`);
    },
    isSettingsScreenActive,
    retrieveSelection() {
      const { settings } = store.getState();

      return settings.lastTrackedStoryId;
    },
    storeSelection: async () => {
      const { storyId, settings } = store.getState();

      await store.setState({
        settings: { ...settings, lastTrackedStoryId: storyId },
      });
    },
  };

  return {
    state: { settings: { lastTrackedStoryId: null } },
    api,
  };
};
