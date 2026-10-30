import { readFile } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { projectMdxReader } from './server/read-mdx.ts';
import {
  BLOCK_BUILDER_ENV,
  componentBlocksLauncher,
  emitStaticComponentBlocks,
} from './server/component-blocks.ts';
import {
  emitStaticMdxDuringBuild,
  type StaticBuildOptions,
} from './server/emit-static-manifest.ts';
import { addMdxSourceRule, managerDocsMdxPlugin } from './server/mdx-as-data.ts';
import { docsMdxFiles, watchMdxSources } from './server/watch-mdx.ts';
import type { IndexedEntry } from './runtime/docs-page.ts';
import { MDX_SOURCE_CHANGED, serveMdxSource } from './runtime/source-transport.ts';

export const experimentalManagerDocs = true;

type ServerChannelOptions = {
  presets?: {
    apply: (extension: string) => Promise<unknown>;
  };
};

type DevIndexGenerator = {
  getIndex: () => Promise<{ entries: Record<string, IndexedEntry> }>;
  onInvalidated?: (listener: () => void) => () => void;
};

export async function experimental_serverChannel(channel: Channel, options?: ServerChannelOptions) {
  const projectRoot = process.cwd();
  const read = projectMdxReader(projectRoot, (absolutePath) => readFile(absolutePath, 'utf8'));
  serveMdxSource(channel, read);
  if (options?.presets) {
    const watcher = watchMdxSources({
      projectRoot,
      read,
      publish: (change) => channel.emit(MDX_SOURCE_CHANGED, change),
    });
    void watchIndexedDocs(options.presets, watcher.watch).catch((error: unknown) => {
      logger.warn(`Manager docs cannot watch MDX files: ${String(error)}`);
    });
  }
  return channel;
}

async function watchIndexedDocs(
  presets: NonNullable<ServerChannelOptions['presets']>,
  watch: (importPaths: string[]) => void
) {
  const generator = (await presets.apply('storyIndexGenerator')) as DevIndexGenerator | undefined;
  if (!generator) {
    return;
  }
  const refresh = async () => {
    watch(docsMdxFiles(Object.values((await generator.getIndex()).entries)));
  };
  generator.onInvalidated?.(() => {
    void refresh().catch((error: unknown) => {
      logger.warn(`Manager docs cannot refresh watched MDX files: ${String(error)}`);
    });
  });
  await refresh();
}

type VitePreviewConfig = {
  plugins?: unknown[];
};

type PreviewBuilderOptions = StaticBuildOptions & Partial<Omit<Options, 'presets'>>;

export async function viteFinal<Config>(
  config: Config,
  options: PreviewBuilderOptions
): Promise<Config> {
  if (!process.env[BLOCK_BUILDER_ENV]) {
    await emitStaticMdxDuringBuild(options);
    await emitStaticComponentBlocks(options as Options);
  }
  const viteConfig = config as Config & VitePreviewConfig;
  const launchesBlocks =
    options.configType === 'DEVELOPMENT' && !!options.channel && !process.env[BLOCK_BUILDER_ENV];
  viteConfig.plugins = [
    managerDocsMdxPlugin(),
    ...(launchesBlocks ? [componentBlocksLauncher(options as Options)] : []),
    ...(viteConfig.plugins ?? []),
  ];
  return config;
}

type WebpackPreviewConfig = {
  module?: {
    rules?: unknown[];
  };
};

export async function webpackFinal<Config>(
  config: Config,
  options: StaticBuildOptions
): Promise<Config> {
  await emitStaticMdxDuringBuild(options);
  return addMdxSourceRule(config as Config & WebpackPreviewConfig);
}
