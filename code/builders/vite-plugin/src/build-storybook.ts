import { cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dirname, join, parse } from 'pathe';
import type { ViteBuilder } from 'vite';

import { buildFrameworkGlobalsFromOptions } from '../../../core/src/builder-manager/utils/framework';
import { readTemplate, renderHTML } from '../../../core/src/builder-manager/utils/template';
import { bundlerOptionsKey } from '../../builder-vite/src/utils/vite-features';

const storybookPackageDir = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
const CORE_MANAGER_DIR = join(storybookPackageDir, 'dist/manager');

/**
 * Build the storybook environment as a static site.
 * Called during `vite build --app` when the builder processes the storybook environment.
 */
export async function buildStorybookEnvironment(
  builder: ViteBuilder,
  options: Options,
  outputDir: string
): Promise<void> {
  const storybookEnv = builder.environments['storybook'];
  if (!storybookEnv) {
    logger.warn('Storybook environment not found, skipping storybook build.');
    return;
  }

  logger.info('Building Storybook...');

  await builder.build(storybookEnv);
  await buildManagerStatic(options, outputDir);

  await cp(CORE_MANAGER_DIR, join(outputDir, 'sb-manager'), {
    filter: (src) => {
      const { ext } = parse(src);
      return ext ? ext === '.js' : true;
    },
    recursive: true,
  });

  logger.info(`Storybook built to ${outputDir}`);
}

async function buildManagerStatic(options: Options, outputDir: string): Promise<void> {
  const { getRefs } = await import('storybook/internal/common');
  const { basename } = await import('pathe');

  const refs = getRefs(options);
  const favicon = options.presets.apply<string>('favicon').then((p) => basename(p));
  const features = options.presets.apply<Record<string, string | boolean>>('features');
  const logLevel = options.presets.apply<string>('logLevel');
  const title = options.presets.apply<string>('title');
  const docsOptions = options.presets.apply('docs', {});
  const tagsOptions = options.presets.apply('tags', {});
  const template = readTemplate('template.ejs');
  const customHead = options.presets.apply<string>('managerHead');

  const globals: Record<string, any> = await buildFrameworkGlobalsFromOptions(options);

  const html = await renderHTML(
    template,
    title,
    favicon,
    customHead,
    [],
    [],
    features,
    refs,
    logLevel,
    docsOptions,
    tagsOptions,
    {
      ...options,
      configType: 'PRODUCTION',
      previewUrl: 'iframe.html',
    },
    globals
  );

  await writeFile(join(outputDir, 'index.html'), html);
}

/**
 * Returns the build configuration for the storybook environment.
 * Used in the plugin's configEnvironment hook.
 */
export function getStorybookBuildConfig(
  options: Options,
  outputDir: string
): { build: Record<string, any> } {
  const iframePath = fileURLToPath(
    import.meta.resolve('@storybook/builder-vite/input/iframe.html')
  );

  return {
    build: {
      outDir: outputDir,
      emptyOutDir: false,
      [bundlerOptionsKey]: {
        input: iframePath,
        external: [/\.\/sb-common-assets\/.*\.woff2/],
      },
    },
  };
}
