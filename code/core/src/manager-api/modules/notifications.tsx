import React from 'react';

import {
  OPEN_IN_EDITOR_RESPONSE,
  type OpenInEditorResponsePayload,
} from 'storybook/internal/core-events';
import type { API_Notification } from 'storybook/internal/types';

import { FailedIcon } from '@storybook/icons';

import { partition } from 'es-toolkit/array';
import { color } from 'storybook/theming';

import type { ModuleFn } from '../lib/types';

export interface SubState {
  notifications: API_Notification[];
}

/** The API for managing notifications. */
export interface SubAPI {
  /**
   * Adds a new notification to the list of notifications. If a notification with the same ID
   * already exists, it will be replaced.
   *
   * @param notification - The notification to add.
   */
  addNotification: (notification: API_Notification) => void;

  /**
   * Removes a notification from the list of notifications and calls the onClear callback.
   *
   * @param id - The ID of the notification to remove.
   */
  clearNotification: (id: string) => void;
}

export const init: ModuleFn = ({ store, provider }) => {
  const api: SubAPI = {
    addNotification: (newNotification) => {
      store.setState(({ notifications }) => {
        const [existing, others] = partition(notifications, (n) => n.id === newNotification.id);
        existing.forEach((notification) => {
          if (notification.onClear) {
            notification.onClear({ dismissed: false, timeout: false });
          }
        });
        return { notifications: [...others, newNotification] };
      });
    },

    clearNotification: (notificationId) => {
      store.setState(({ notifications }) => {
        const [matching, others] = partition(notifications, (n) => n.id === notificationId);
        matching.forEach((notification) => {
          if (notification.onClear) {
            notification.onClear({ dismissed: false, timeout: false });
          }
        });
        return { notifications: others };
      });
    },
  };

  const state: SubState = { notifications: [] };

  return {
    api,
    state,
    init: async () => {
      provider.channel?.on(OPEN_IN_EDITOR_RESPONSE, (payload: OpenInEditorResponsePayload) => {
        if (payload.error !== null) {
          api.addNotification({
            id: 'open-in-editor-error',
            content: {
              headline: 'Failed to open in editor',
              subHeadline:
                payload.error ||
                'Check the Storybook process on the command line for more details.',
            },
            icon: <FailedIcon color={color.negative} />,
            duration: 8_000,
          });
        }
      });
    },
  };
};
