import type { Options as CoreOptions } from 'storybook/internal/types';

import type { BuilderContext } from '@angular-devkit/architect';
import type { StandaloneOptions } from '../builders/utils/standalone-options';

export type PresetOptions = CoreOptions & {
  /* Allow to get the options of a targeted "browser builder"  */
  angularBrowserTarget?: string | null;
  /* Defined set of options. These will take over priority from angularBrowserTarget options  */
  angularBuilderOptions?: StandaloneOptions['angularBuilderOptions'];
  /* Angular context from builder */
  angularBuilderContext?: BuilderContext | null;
  tsConfig?: string;
};
