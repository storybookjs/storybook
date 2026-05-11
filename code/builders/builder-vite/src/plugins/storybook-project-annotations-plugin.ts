import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { generateProjectAnnotationsCode } from '../codegen-project-annotations.ts';
import { getResolvedVirtualModuleId } from '../virtual-file-names.ts';

export const VIRTUAL_ID = 'virtual:/@storybook/builder-vite/project-annotations.js';
const RESOLVED_VIRTUAL_ID = getResolvedVirtualModuleId(VIRTUAL_ID);

/**
 * A Vite plugin that serves the project annotations virtual module.
 *
 * The virtual module can be imported as:
 *
 * ```ts
 * import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
 * ```
 */
export function storybookProjectAnnotationsPlugin(options: Options): Plugin {
  let projectRoot: string;

  return {
    name: 'storybook:project-annotations-plugin',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root;
    },
    resolveId(source) {
      // Query-tolerant match — see `code-generator-plugin.ts` for the
      // rationale. Per-environment routing addons append markers like
      // `?env=before`; preserving the query on the resolved ID keeps the
      // module graph properly partitioned.
      const [bareSource, query] = source.split('?');
      if (bareSource === VIRTUAL_ID) {
        return `${RESOLVED_VIRTUAL_ID}${query ? `?${query}` : ''}`;
      }
    },
    async load(id) {
      if (id.split('?')[0] === RESOLVED_VIRTUAL_ID) {
        return generateProjectAnnotationsCode(options, projectRoot);
      }
    },
  };
}
