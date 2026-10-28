import { defineRenderer } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';

import { createDocgenDescriptor, withComponentsManifest } from './docgen/provider.ts';
import { experimental_storyDocsProvider } from './docgen/story-docs-provider.ts';
import { getPreviewAnnotations } from './preview-annotations.ts';
import type { WebComponentsFrameworkOptions, WebComponentsTypes } from './types.ts';

export type { WebComponentsTypes } from './types.ts';

/** Configure Web Components rendering, annotations, and docgen. */
export const webComponents = defineRenderer<void, WebComponentsTypes>(() => ({
  meta: { name: '@storybook/web-components' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
    // Turns `features.docgenServer` on by default.
    storybook.hook('core:docgen-enabled:extend', () => true);
    storybook.hook('core:docgen-providers:collect', async () => [
      createDocgenDescriptor(
        storybook.configDir,
        (await storybook.callHook('core:framework-options:extend', {})) as
          | WebComponentsFrameworkOptions
          | null
          | undefined
      ),
    ]);
    storybook.hook('core:story-docs-provider:extend', (value, ctx) =>
      experimental_storyDocsProvider(value ?? (async () => undefined), ctx as Options)
    );
    storybook.hook('index:manifests:extend', async (value) =>
      withComponentsManifest(value ?? {}, await storybook.callHook('core:features:extend', {}))
    );
  },
}));

export default webComponents;
