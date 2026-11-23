import type { API_Notification } from 'storybook/internal/types';

import { partition } from 'es-toolkit/array';

import type { ModuleFn } from '../lib/types.tsx';

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

export const init: ModuleFn = ({ store }) => {
  const replace = (id: string, replacement: API_Notification[]) => {
    const [removed, others] = partition(store.getState().notifications, (n) => n.id === id);
    store.setState({ notifications: [...others, ...replacement] });
    removed.forEach((notification) => notification.onClear?.({ dismissed: false, timeout: false }));
  };

  const api: SubAPI = {
    addNotification: (newNotification) => replace(newNotification.id, [newNotification]),
    clearNotification: (notificationId) => replace(notificationId, []),
  };

  const state: SubState = { notifications: [] };

  return {
    api,
    state,
  };
};
