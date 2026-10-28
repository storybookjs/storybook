import type { EnrichCsfOptions } from '@storybook/core/internal/csf-tools';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import type { CompileOptions } from '../compiler/index.ts';

/** Configure documentation defaults and compilation. */
export interface DocsOptions {
  /** Name generated documentation entries. */
  defaultName?: NonNullable<StorybookConfigRaw['docs']>['defaultName'];
  /** Configure or disable CSF enrichment. */
  csfPluginOptions?: EnrichCsfOptions | null;
  /** Configure MDX compilation. */
  mdxPluginOptions?: CompileOptions;
}
