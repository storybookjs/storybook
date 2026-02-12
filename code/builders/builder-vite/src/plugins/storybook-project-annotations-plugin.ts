import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { generateProjectAnnotationsCode } from '../codegen-project-annotations';
import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names';

const VIRTUAL_ID = 'virtual:/@storybook/builder-vite/project-annotations.js';
const RESOLVED_VIRTUAL_ID = getResolvedVirtualModuleId(VIRTUAL_ID);

/**
 * A Vite plugin that serves the project annotations virtual module.
 *
 * This plugin handles the `virtual:/@storybook/builder-vite/project-annotations.js` virtual module,
 * which exports a `getProjectAnnotations` function that composes all preview annotations (from
 * addons, frameworks, and the user's preview file) into a single configuration object.
 *
 * The virtual module can be imported as:
 *
 * ```ts
 * import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
 * ```
 *
 * This plugin is extracted from the builder-specific code-generator-plugin so that it can be shared
 * with `@storybook/addon-vitest` and other consumers that need access to the composed project
 * annotations without the full builder entry-point machinery (iframe handling, story index
 * watching, etc.).
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
