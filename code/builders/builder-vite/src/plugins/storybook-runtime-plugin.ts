import type { PreviewSources } from '@storybook/core/internal/preview-page';

import type { Plugin } from 'vite';

/** Expose Storybook's environment to preview code through `import.meta.env`. */
export function storybookEnvPlugin(preview: PreviewSources): Plugin {
  return {
    name: 'storybook:env-plugin',
    config(config) {
      return { define: preview.define({ env: 'import.meta.env', envPrefix: config.envPrefix }) };
    },
  };
}
