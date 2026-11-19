import type { Options as CoreOptions } from 'storybook/internal/types';

import type { BuilderContext } from '@angular-devkit/architect';
import type { StandaloneOptions } from '../builders/utils/standalone-options.ts';

export type PresetOptions = CoreOptions & {
  /* Allow to get the options of a targeted "browser builder"  */
  angularBrowserTarget?: string | null;
  /* Options of the Storybook target, already merged over the angularBrowserTarget options by
   * the builders before Storybook runs */
  angularBuilderOptions?: StandaloneOptions['angularBuilderOptions'];
  /* Angular context from builder */
  angularBuilderContext?: BuilderContext | null;
  tsConfig?: string;
};
