import { ADDON_ID } from '../constants.js';
import { addons } from '@storybook/manager-api'; // eslint-disable-line import/no-extraneous-dependencies

// Register the addon
addons.register(ADDON_ID, () => {});
