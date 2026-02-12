import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { generateProjectAnnotationsCode } from '../codegen-project-annotations';
import { getResolvedVirtualModuleId } from '../virtual-file-names';

const VIRTUAL_ID = 'virtual:/@storybook/builder-vite/project-annotations.js';
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
      if (source === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        return generateProjectAnnotationsCode(options, projectRoot);
      }
    },
  };
}
