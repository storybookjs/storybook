import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core'> = {
  builder: require.resolve('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/web-components'),
};
