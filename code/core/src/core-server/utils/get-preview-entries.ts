import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { isAbsolute, normalize, resolve } from 'pathe';

/**
 * Absolute paths of what affects every story: the config directory, the project's preview file and
 * every preview annotation, relative ones resolved against the project directory. What the files
 * import affects every story too.
 */
export async function getPreviewEntries(options: Options): Promise<string[]> {
  const annotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
  const previewFile = loadPreviewOrConfigFile({ configDir: options.configDir });
  return [options.configDir, ...annotations, previewFile].flatMap((entry) => {
    const path = typeof entry === 'object' ? entry.absolute : entry;
    if (!path) {
      return [];
    }
    return [normalize(isAbsolute(path) ? path : resolve(process.cwd(), path))];
  });
}
