import { logger } from 'storybook/internal/node-logger';

import type { Preset, StorybookConfig } from '@storybook/core-webpack';

import { isReactScriptsInstalled } from './cra-config';

const checkForNewPreset = (presetsList: Preset[]) => {
  const hasNewPreset = presetsList.some((preset: Preset) => {
    const presetName = typeof preset === 'string' ? preset : preset.name;
    return /@storybook(\/|\\)preset-create-react-app/.test(presetName);
  });

  if (!hasNewPreset) {
    logger.warn('Storybook support for Create React App is now a separate preset.');
    logger.warn(
      'To use the new preset, install `@storybook/preset-create-react-app` and add it to the list of `addons` in your `.storybook/main.js` config file.'
    );
    logger.warn('The built-in preset has been disabled in Storybook 6.0.');
  }
};

export const webpackFinal: StorybookConfig['webpack'] = (config, { presetsList }) => {
  if (isReactScriptsInstalled()) {
    if (presetsList) {
      checkForNewPreset(presetsList);
    }
  }
  config.module?.rules?.push(
    ...[
      {
        test: /\.m?js$/,
        type: 'javascript/auto',
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ]
  );
  return config;
};
