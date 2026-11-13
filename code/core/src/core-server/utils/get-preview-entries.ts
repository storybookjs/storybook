import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { isAbsolute, normalize, resolve } from 'pathe';

/**
 * Absolute paths of the files the preview starts from: the project's preview file and every preview
 * annotation, resolved the way the builders resolve them. What they import affects every story.
 */
export async function getPreviewEntries(options: Options): Promise<string[]> {
  const annotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
  const previewFile = loadPreviewOrConfigFile({ configDir: options.configDir });
  return [...annotations, previewFile].flatMap((entry) => {
    const path = typeof entry === 'object' ? entry.absolute : entry;
    if (!path) {
      return [];
    }
    return [normalize(isAbsolute(path) ? path : resolve(process.cwd(), path))];
  });
}
