import measureAddon from '@storybook/addon-measure';
import outlineAddon from '@storybook/addon-outline';

import { composeConfigs } from 'storybook/preview-api';

export default composeConfigs([measureAddon(), outlineAddon()]);
