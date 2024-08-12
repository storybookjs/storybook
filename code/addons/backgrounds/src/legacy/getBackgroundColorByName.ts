import { logger } from 'storybook/internal/client-logger';

import { dedent } from 'ts-dedent';

import type { Background } from '../types';

export const getBackgroundColorByName = (
  currentSelectedValue: string,
  backgrounds: Background[] = [],
  defaultName: string | null | undefined
): string => {
  if (currentSelectedValue === 'transparent') {
    return 'transparent';
  }

  if (backgrounds.find((background) => background.value === currentSelectedValue)) {
    return currentSelectedValue;
  }

  if (currentSelectedValue) {
    return currentSelectedValue;
  }

  const defaultBackground = backgrounds.find((background) => background.name === defaultName);
  if (defaultBackground) {
    return defaultBackground.value;
  }

  if (defaultName) {
    const availableColors = backgrounds.map((background) => background.name).join(', ');
    logger.warn(
      dedent`
        Backgrounds Addon: could not find the default color "${defaultName}".
        These are the available colors for your story based on your configuration:
        ${availableColors}.
      `
    );
  }

  return 'transparent';
};
