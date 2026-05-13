import { cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dirname, join, parse } from 'pathe';
import type { Plugin, ViteBuilder } from 'vite';

import {
  buildFrameworkGlobalsFromOptions,
  readTemplate,
  renderHTML,
} from 'storybook/internal/builder-manager';

const storybookPackageDir = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
const CORE_MANAGER_DIR = join(storybookPackageDir, 'dist/manager');

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
  await buildStoryIndex(options, outputDir);

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

async function buildStoryIndex(options: Options, outputDir: string): Promise<void> {
  const storyIndexGenerator =
    await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
  const storyIndex = await storyIndexGenerator.getIndex();
  await writeFile(join(outputDir, 'index.json'), JSON.stringify(storyIndex));
}

export function buildStorybookPlugin(options: Options): Plugin {
  return {
    name: 'storybook:build',
    apply: (_, { command, mode }) => command === 'build' && mode === 'storybook',
    config() {
      return {
        builder: {
          async buildApp(builder) {
            await buildStorybookEnvironment(builder, options, 'storybook-static');
          },
        },
      };
    },
  };
}
