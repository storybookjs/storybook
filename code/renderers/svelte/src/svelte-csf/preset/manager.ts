import { ADDON_ID } from '../constants.js';
import { addons } from '@storybook/manager-api';

// Register the addon
addons.register(ADDON_ID, () => {});
