import { logger } from '@storybook/core/client-logger';

import { deletedDiff } from 'deep-object-diff';
import { dedent } from 'ts-dedent';

import { convert } from './convert';
import light from './themes/light';
import type { StorybookTheme, ThemeVars } from './types';

export const ensure = (input: ThemeVars): StorybookTheme => {
  if (!input) {
    return convert(light);
  }
  const missing = deletedDiff(light, input);
  if (Object.keys(missing).length) {
    logger.warn(
      dedent`
          Your theme is missing properties, you should update your theme!

          theme-data missing:
        `,
      missing
    );
  }

  return convert(input);
};
