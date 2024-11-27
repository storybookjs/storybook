import type { Options as CoreOptions } from 'storybook/internal/types';

import type { BuilderContext } from '@angular-devkit/architect';
import type { StylePreprocessorOptions } from '@angular-devkit/build-angular';
import type { StyleElement } from '@angular-devkit/build-angular/src/builders/browser/schema';

export type PresetOptions = CoreOptions & {
  /* Allow to get the options of a targeted "browser builder"  */
  angularBrowserTarget?: string | null;
  /* Defined set of options. These will take over priority from angularBrowserTarget options  */
  angularBuilderOptions?: {
    styles?: StyleElement[];
    stylePreprocessorOptions?: StylePreprocessorOptions;
  };
  /* Angular context from builder */
  angularBuilderContext?: BuilderContext | null;
  tsConfig?: string;
};
