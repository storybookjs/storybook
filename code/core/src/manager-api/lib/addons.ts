import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/client-logger';
import { SET_CONFIG } from 'storybook/internal/core-events';
import type {
  Addon_BaseType,
  Addon_Collection,
  Addon_Config,
  Addon_Elements,
  Addon_Loaders,
  Addon_PageType,
  Addon_TestProviderType,
  Addon_Type,
  Addon_Types,
  Addon_TypesMapping,
  Addon_WrapperType,
} from 'storybook/internal/types';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { API } from '../root';
import { mockChannel } from './storybook-channel-mock';

export type { Addon_Type as Addon };
export { Addon_TypesEnum as types };

export function isSupportedType(type: Addon_Types): boolean {
  return !!Object.values(Addon_TypesEnum).find((typeVal) => typeVal === type);
}

export class AddonStore {
  constructor() {
    this.promise = new Promise((res) => {
      this.resolve = () => res(this.getChannel());
    }) as Promise<Channel>;
  }

  private loaders: Addon_Loaders<API> = {};

  private elements: Addon_Elements = {};

  private config: Addon_Config = {};

  private channel: Channel | undefined;

  private promise: any;

  private resolve: any;

  getChannel = (): Channel => {
    // this.channel should get overwritten by setChannel. If it wasn't called (e.g. in non-browser environment), set a mock instead.
    if (!this.channel) {
      this.setChannel(mockChannel());
    }

    return this.channel!;
  };

  ready = (): Promise<Channel> => this.promise;

  hasChannel = (): boolean => !!this.channel;

  setChannel = (channel: Channel): void => {
    this.channel = channel;
    this.resolve();
  };

  getElements<
    T extends
      | Addon_Types
      | Addon_TypesEnum.experimental_PAGE
      | Addon_TypesEnum.experimental_TEST_PROVIDER,
  >(type: T): Addon_Collection<Addon_TypesMapping[T]> | any {
    if (!this.elements[type]) {
      this.elements[type] = {};
    }
    return this.elements[type];
  }

  /**
   * Adds an addon to the addon store.
   *
   * @param {string} id - The id of the addon.
   * @param {Addon_Type} addon - The addon to add.
   * @returns {void}
   */
  add(
    id: string,
    addon:
      | Addon_BaseType
      | Omit<Addon_TestProviderType, 'id'>
      | Omit<Addon_PageType, 'id'>
      | Omit<Addon_WrapperType, 'id'>
  ): void {
    const { type } = addon;
    const collection = this.getElements(type);
    collection[id] = { ...addon, id };
  }

  setConfig = (value: Addon_Config) => {
    Object.assign(this.config, value);
    if (this.hasChannel()) {
      this.getChannel().emit(SET_CONFIG, this.config);
    } else {
      this.ready().then((channel) => {
        channel.emit(SET_CONFIG, this.config);
      });
    }
  };

  getConfig = () => this.config;

  /**
   * Registers an addon loader function.
   *
   * @param {string} id - The id of the addon loader.
   * @param {(api: API) => void} callback - The function that will be called to register the addon.
   * @returns {void}
   */
  register = (id: string, callback: (api: API) => void): void => {
    if (this.loaders[id]) {
      logger.warn(`${id} was loaded twice, this could have bad side-effects`);
    }
    this.loaders[id] = callback;
  };

  loadAddons = (api: any) => {
    Object.values(this.loaders).forEach((value: any) => value(api));
  };

  experimental_getRegisteredAddons() {
    return Object.keys(this.loaders);
  }
}

// Enforce addons store to be a singleton
const KEY = '__STORYBOOK_ADDONS_MANAGER';

function getAddonsStore(): AddonStore {
  if (!global[KEY]) {
    global[KEY] = new AddonStore();
  }
  return global[KEY];
}

export const addons = getAddonsStore();

export { mockChannel };
