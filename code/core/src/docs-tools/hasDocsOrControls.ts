import type { Options } from 'storybook/internal/types';

// `addons/x` is for the monorepo, `addon-x` is for normal usage
const packageRe = /(addons\/|addon-|addon-essentials\/)(docs|controls)/;

export const hasDocsOrControls = (options: Options) =>
  options.presetsList?.some((preset: any) => packageRe.test(preset.name));
