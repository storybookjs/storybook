import { definePreviewAddon } from 'storybook/internal/csf';

import type { ControlsTypes } from './types';

export type { ControlsTypes };

export default definePreviewAddon<ControlsTypes>({
  // Controls addon doesn't need any preview-side configuration
  // It operates entirely through the manager UI
});
