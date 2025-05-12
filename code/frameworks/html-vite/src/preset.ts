import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

function getAbsolutePath<I extends string>(value: I): I {
  return dirname(require.resolve(join(value, 'package.json'))) as any;
}

export const core: PresetProperty<'core'> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/html'),
};
