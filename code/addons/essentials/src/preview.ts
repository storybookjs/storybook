import backgroundsAddon from '@storybook/addon-backgrounds';
import highlightAddon from '@storybook/addon-highlight';
import measureAddon from '@storybook/addon-measure';
import outlineAddon from '@storybook/addon-outline';
import viewportAddon from '@storybook/addon-viewport';

import { composeConfigs } from 'storybook/preview-api';

export default composeConfigs([
  backgroundsAddon(),
  viewportAddon(),
  measureAddon(),
  outlineAddon(),
  highlightAddon(),
]);
