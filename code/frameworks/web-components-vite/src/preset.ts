import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export const core: PresetProperty<'core'> = {
  builder: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
  renderer: fileURLToPath(import.meta.resolve('@storybook/web-components/preset')),
};
