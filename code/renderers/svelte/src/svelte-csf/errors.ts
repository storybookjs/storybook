import { StorybookError } from 'storybook/internal/server-errors';

import { dedent } from 'ts-dedent';

// The renderer owns this category, so no other package uses its codes
const CATEGORY = 'SVELTE_CSF_PRESET';

export class SvelteCsfAddonInstalledError extends StorybookError {
  constructor(public data: { frameworkPackage: string | undefined; legacyTemplate: boolean }) {
    super({
      name: 'SvelteCsfAddonInstalledError',
      category: CATEGORY,
      code: 1,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#svelte-csf-is-built-into-the-svelte-frameworks',
      message: [
        dedent`
          Svelte CSF is built into Storybook's Svelte frameworks, so the @storybook/addon-svelte-csf addon is no longer needed.
          Remove it from "addons" in your main config and from your dependencies, and import defineMeta from ${
            data.frameworkPackage ? `"${data.frameworkPackage}"` : 'your framework package'
          }.
          Run "npx storybook automigrate" to do this for you.`,
        data.legacyTemplate
          ? dedent`
              Your addon config sets "legacyTemplate: true". Storybook 11 removed the legacy Svelte CSF syntax (<Meta>, export const meta and <Template>), so migrate those stories to defineMeta first.`
          : undefined,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }
}
