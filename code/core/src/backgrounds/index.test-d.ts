import { expectTypeOf } from 'vitest';

import { DEFAULT_BACKGROUNDS } from 'storybook/backgrounds';
import type { Background, BackgroundMap } from 'storybook/backgrounds';

expectTypeOf<BackgroundMap>().toEqualTypeOf<Record<string, Background>>();

expectTypeOf(DEFAULT_BACKGROUNDS).toEqualTypeOf<BackgroundMap>();

const customBackgrounds = {
  light: { name: 'Light', value: '#ffffff' },
  dark: { name: 'Dark', value: '#1a1a1a' },
} satisfies BackgroundMap;

expectTypeOf(customBackgrounds.light).toExtend<Background>();
