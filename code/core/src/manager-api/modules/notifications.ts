import type { API_Notification } from '@storybook/core/types';

import partition from 'lodash/partition.js';

import type { ModuleFn } from '../lib/types';

export interface SubState {
  notifications: API_Notification[];
}

/**
 * The API for managing notifications.
 */
export interface SubAPI {
  /**
   * Adds a new notification to the list of notifications.
   * If a notification with the same ID already exists, it will be replaced.
   * @param notification - The notification to add.
   */
  addNotification: (notification: API_Notification) => void;

  /**
   * Removes a notification from the list of notifications and calls the onClear callback.
   * @param id - The ID of the notification to remove.
   */
  clearNotification: (id: string) => void;
}

export const init: ModuleFn = ({ store }) => {
  const api: SubAPI = {
    addNotification: (newNotification) => {
      store.setState(({ notifications }) => {
        const [existing, others] = partition(notifications, (n) => n.id === newNotification.id);
        existing.forEach((notification) => {
          if (notification.onClear) notification.onClear({ dismissed: false, timeout: false });
        });
        return { notifications: [...others, newNotification] };
      });
    },

    clearNotification: (notificationId) => {
      store.setState(({ notifications }) => {
        const [matching, others] = partition(notifications, (n) => n.id === notificationId);
        matching.forEach((notification) => {
          if (notification.onClear) notification.onClear({ dismissed: false, timeout: false });
        });
        return { notifications: others };
      });
    },
  };

  const state: SubState = { notifications: [] };

  return { api, state };
};
