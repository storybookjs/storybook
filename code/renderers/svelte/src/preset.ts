import type { PresetProperty } from 'storybook/internal/types';

import { createPreviewAnnotations } from 'storybook/internal/common';

export const previewAnnotations: PresetProperty<'previewAnnotations'> =
  createPreviewAnnotations('@storybook/svelte');
