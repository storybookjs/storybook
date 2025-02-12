import { definePreviewAddon } from 'storybook/internal/csf';

import type { ControlsTypes } from './types';

export { PARAM_KEY } from './constants';

export default () => definePreviewAddon<ControlsTypes>({});

export type { ControlsTypes };
