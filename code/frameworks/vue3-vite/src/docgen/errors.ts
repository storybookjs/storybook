import { Category, StorybookError } from 'storybook/internal/server-errors';

export class Vue3ViteDocgenManifestError extends StorybookError {
  constructor() {
    super({
      name: 'Vue3ViteDocgenManifestError',
      category: Category.FRAMEWORK_VUE3_VITE,
      code: 1,
      message:
        "The Vue docgen manifest currently requires `docgen: 'vue-component-meta'` in `framework.options`.\n" +
        'Update the Vue framework configuration or disable `features.componentsManifest`.',
    });
  }
}
