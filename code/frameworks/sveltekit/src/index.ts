import type {
  AddonTypes,
  InferTypes,
  PreviewAddon,
  PreviewAddonEntry,
} from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { SveltePreview, SvelteTypes } from '@storybook/svelte';
import { __definePreview } from '@storybook/svelte';

import * as svelteKitPreview from './preview.ts';
import type { SvelteKitTypes } from './types.ts';

export * from '@storybook/svelte';
export * from './types.ts';
// @ts-expect-error (double exports)
export * from './portable-stories.ts';

/**
 * Define the preview of a SvelteKit project, with the `preview.meta()` and `meta.story()`
 * factories. It includes the SvelteKit mocks, configured with `parameters.sveltekit_experimental`.
 */
export function definePreview<Addons extends PreviewAddonEntry[] = []>(
  preview: { addons?: Addons } & ProjectAnnotations<
    SvelteTypes & SvelteKitTypes & InferTypes<Addons>
  >
): SvelteKitPreview<InferTypes<Addons>> {
  return __definePreview({
    ...preview,
    addons: [svelteKitPreview, ...(preview.addons ?? [])] as PreviewAddon<
      SvelteKitTypes & InferTypes<Addons>
    >[],
  });
}

export interface SvelteKitPreview<T extends AddonTypes> extends SveltePreview<SvelteKitTypes & T> {}
