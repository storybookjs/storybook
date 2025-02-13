import { composeConfigs } from 'storybook/internal/preview-api';

import actionsAddon from '@storybook/addon-actions';
import backgroundsAddon from '@storybook/addon-backgrounds';
// We can't use docs as function yet because of the --test flag. Once we figure out disabling docs properly in CSF4, we can change this
// eslint-disable-next-line import/namespace
import * as docsAddon from '@storybook/addon-docs/preview';
import highlightAddon from '@storybook/addon-highlight';
import measureAddon from '@storybook/addon-measure';
import outlineAddon from '@storybook/addon-outline';
import viewportAddon from '@storybook/addon-viewport';

export default composeConfigs([
  actionsAddon(),
  // TODO: we can't use this as function because of the --test flag
  docsAddon,
  backgroundsAddon(),
  viewportAddon(),
  measureAddon(),
  outlineAddon(),
  highlightAddon(),
]);
