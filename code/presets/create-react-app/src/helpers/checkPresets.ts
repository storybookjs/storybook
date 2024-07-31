import { logger } from 'storybook/internal/node-logger';
import type { PluginOptions } from '../types';

const incompatiblePresets = ['@storybook/preset-scss', '@storybook/preset-typescript'];

export const checkPresets = (options: PluginOptions): void => {
  const { presetsList } = options;

  presetsList?.forEach((preset: string | { name: string }) => {
    const presetName = typeof preset === 'string' ? preset : preset.name;
    if (incompatiblePresets.includes(presetName)) {
      logger.warn(
        `\`${presetName}\` may not be compatible with \`@storybook/preset-create-react-app\``
      );
    }
  });
};
