import type { ModuleInfo, PluginContext } from 'rollup';
import { expect, it } from 'vitest';

import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names.ts';
import { VIRTUAL_ID as PROJECT_ANNOTATIONS_VIRTUAL_ID } from './storybook-project-annotations-plugin.ts';
import { pluginWebpackStats } from './webpack-stats-plugin.ts';

const VITE_APP_ID = getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE);
const PROJECT_ANNOTATIONS_ID = getResolvedVirtualModuleId(PROJECT_ANNOTATIONS_VIRTUAL_ID);

it('includes project annotations and their dependencies in stats', () => {
  const plugin = pluginWebpackStats({ workingDir: '/project' });
  const moduleParsed = plugin.moduleParsed;

  if (typeof moduleParsed !== 'function') {
    throw new TypeError('Expected moduleParsed to be a function');
  }

  const parseModule = (id: string, importedIds: string[]) =>
    moduleParsed.call(
      {} as PluginContext,
      {
        id,
        importedIds,
        dynamicallyImportedIds: [],
      } as unknown as ModuleInfo
    );

  parseModule(VITE_APP_ID, [PROJECT_ANNOTATIONS_ID]);
  parseModule(PROJECT_ANNOTATIONS_ID, ['/project/node_modules/test-addon/preview.js']);
  parseModule('/project/node_modules/test-addon/preview.js', [
    '/project/node_modules/test-addon/runtime.js',
  ]);
  parseModule('/project/src/Button.stories.js', [
    '/project/node_modules/test-addon/runtime.js',
    '\0virtual:/unrelated.js',
  ]);

  // These names are a cross-repo contract: chromaui/chromatic-cli locates the stories entry and the
  // preview-subgraph root by exact name, so they are spelled out here rather than derived from the
  // constants above. Renaming a virtual module without a matching
  // chromaui/chromatic-cli release silently breaks TurboSnap.
  expect(plugin.storybookGetStats().toJson()).toEqual({
    modules: [
      {
        id: '/virtual:/@storybook/builder-vite/project-annotations.js',
        name: '/virtual:/@storybook/builder-vite/project-annotations.js',
        reasons: [{ moduleName: '/virtual:/@storybook/builder-vite/vite-app.js' }],
      },
      {
        id: './node_modules/test-addon/preview.js',
        name: './node_modules/test-addon/preview.js',
        reasons: [{ moduleName: '/virtual:/@storybook/builder-vite/project-annotations.js' }],
      },
      {
        id: './node_modules/test-addon/runtime.js',
        name: './node_modules/test-addon/runtime.js',
        reasons: [
          { moduleName: './node_modules/test-addon/preview.js' },
          { moduleName: './src/Button.stories.js' },
        ],
      },
    ],
  });
});
