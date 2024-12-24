import type { Listener } from '@storybook/core/channels';
import type { API_Provider } from '@storybook/core/types';

import type { ModuleFn } from '../lib/types';
import type { API } from '../root';

export interface SubAPI {
  /**
   * Returns the channel object.
   *
   * @protected Please do not use, it's for internal use only.
   */
  getChannel: () => API_Provider<API>['channel'];
  /**
   * Adds a listener to the channel for the given event type. Returns a function that can be called
   * to remove the listener.
   *
   * @param type - The event type to listen for. If using a core event, import it from
   *   `@storybook/core-events`.
   * @param handler - The callback function to be called when the event is emitted.
   * @returns A function that can be called to remove the listener.
   */
  on: (type: string, handler: Listener) => () => void;
  /**
   * Removes a listener from the channel for the given event type.
   *
   * @param type - The event type to remove the listener from. If using a core event, import it from
   *   `@storybook/core-events`.
   * @param handler - The callback function to be removed.
   */
  off: (type: string, handler: Listener) => void;
  /**
   * Emits an event on the channel for the given event type.
   *
   * @param type - The event type to emit. If using a core event, import it from
   *   `@storybook/core-events`.
   * @param args - The arguments to pass to the event listener.
   */
  emit: (type: string, ...args: any[]) => void;
  /**
   * Adds a one-time listener to the channel for the given event type.
   *
   * @param type - The event type to listen for. If using a core event, import it from
   *   `@storybook/core-events`.
   * @param handler - The callback function to be called when the event is emitted.
   */
  once: (type: string, handler: Listener) => void;
}

export type SubState = Record<string, never>;

export const init: ModuleFn<SubAPI, SubState> = ({ provider }) => {
  const api: SubAPI = {
    getChannel: () => provider.channel,
    on: (type, handler) => {
      provider.channel?.on(type, handler);

      return () => provider.channel?.off(type, handler);
    },
    off: (type, handler) => provider.channel?.off(type, handler),
    once: (type, handler) => provider.channel?.once(type, handler),
    emit: (type, data, ...args) => {
      if (
        data?.options?.target &&
        data.options.target !== 'storybook-preview-iframe' &&
        !data.options.target.startsWith('storybook-ref-')
      ) {
        data.options.target =
          data.options.target !== 'storybook_internal'
            ? `storybook-ref-${data.options.target}`
            : 'storybook-preview-iframe';
      }
      provider.channel?.emit(type, data, ...args);
    },
  };
  return { api, state: {} };
};
