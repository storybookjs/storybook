import type { Addon_Types } from '@storybook/core/types';

export default class Provider {
  getElements(_type: Addon_Types) {
    throw new Error('Provider.getElements() is not implemented!');
  }

  handleAPI(_api: unknown) {
    throw new Error('Provider.handleAPI() is not implemented!');
  }

  getConfig() {
    console.error('Provider.getConfig() is not implemented!');

    return {};
  }
}
