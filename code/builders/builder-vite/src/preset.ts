import { findConfigFile } from 'storybook/internal/common';
import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Options } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin';
import { storybookOptimizeDepsPlugin } from './plugins/storybook-optimize-deps-plugin';
import { storybookProjectAnnotationsPlugin } from './plugins/storybook-project-annotations-plugin';
import { storybookRuntimePlugin } from './plugins/storybook-runtime-plugin';
import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin';
import { viteMockPlugin } from './plugins/vite-mock/plugin';

/**
 * Preset that provides the core Storybook Vite plugins shared between `@storybook/builder-vite` and
 * `@storybook/addon-vitest`.
 *
 * Includes:
 *
 * - **Config plugin**: Resolve conditions (`storybook`, `stories`, `test`), environment variable
 *   prefixes (`VITE_`, `STORYBOOK_`), symlink preservation, and `fs.allow` for the config
 *   directory
 * - **Project annotations plugin**: Virtual module serving `getProjectAnnotations`
 * - **Docgen plugin**: CSF processing and component metadata extraction
 * - **Runtime plugin**: External globals transformation for pre-bundled Storybook modules
 * - **Mocking plugins**: Injects the mocker runtime script into the HTML and sets up rules to swap
 *   modules based on sb.mock() calls.
 *
 * Consumers can override builder-specific settings (root, base, cacheDir) by adding their own Vite
 * plugins on top.
 */
export async function viteCorePlugins(
  existing: PluginOption[],
  options: Options
): Promise<PluginOption[]> {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  const build = await options.presets.apply('build');
  const externals: Record<string, string> = { ...globalsNameReferenceMap };

  if (build?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }

  return [
    ...(await storybookRuntimePlugin(options)),
    ...storybookConfigPlugin({ configDir: options.configDir, setRoot: false }),
    storybookOptimizeDepsPlugin(options),
    storybookProjectAnnotationsPlugin(options),
    ...(previewConfigPath
      ? [
          viteInjectMockerRuntime({ previewConfigPath }),
          viteMockPlugin({
            previewConfigPath,
            coreOptions: await options.presets.apply('core'),
            configDir: options.configDir,
          }),
        ]
      : []),
  ];
}
