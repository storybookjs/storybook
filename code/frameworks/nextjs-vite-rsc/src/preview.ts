import {
  definePreview as definePreviewBase,
  definePreviewAddon,
  type PreviewAddon,
} from 'storybook/internal/csf';
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { registerStories } from './csf-next.ts';
import * as frameworkAnnotations from './entry-preview.tsx';
import { clientStoryBoundary } from './render.tsx';

// In CSF Next, Storybook takes the annotations from `.storybook/preview` alone, not from the
// `previewAnnotations` of the preset: the framework's come in as the first addon.
export const frameworkAddon = definePreviewAddon(
  frameworkAnnotations as unknown as ProjectAnnotations<Renderer>
);

// `definePreview()` without its types: see index.ts.
export function __definePreview(
  input: { addons?: PreviewAddon<never>[] } & ProjectAnnotations<Renderer>
) {
  // The decorators of the project are Server Components around a client story too
  const decorators = [clientStoryBoundary(), ...[input.decorators ?? []].flat()];
  return registerStories(
    definePreviewBase({
      ...input,
      decorators,
      addons: [frameworkAddon, ...(input.addons ?? [])],
    } as typeof input)
  );
}
