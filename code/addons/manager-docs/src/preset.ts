import { readFile } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { applyMdxSourceChange, registerMdxSourceService } from './mdx-source-service/server.ts';
import { projectMdxReader } from './server/read-mdx.ts';
import {
  BLOCK_BUILDER_ENV,
  componentBlocksLauncher,
  emitStaticComponentBlocks,
} from './server/component-blocks.ts';
import { addMdxSourceRule, managerDocsMdxPlugin } from './server/mdx-as-data.ts';
import { docsMdxFiles, watchMdxSources } from './server/watch-mdx.ts';
import type { IndexedEntry } from './runtime/docs-page.ts';

export const experimentalManagerDocs = true;

export const services = async (_value: void, options: Options): Promise<void> => {
  registerMdxSourceService({
    read: createProjectReader(),
    getIndex: () =>
      options.presets
        .apply<StoryIndexGenerator>('storyIndexGenerator')
        .then((generator) => generator.getIndex()),
  });
};

type ServerChannelOptions = {
  presets?: {
    apply: (extension: string) => Promise<unknown>;
  };
};

type DevIndexGenerator = {
  getIndex: () => Promise<{ entries: Record<string, IndexedEntry> }>;
  onInvalidated?: (listener: () => void) => () => void;
};

function createProjectReader(projectRoot = process.cwd()) {
  return projectMdxReader(projectRoot, (absolutePath) => readFile(absolutePath, 'utf8'));
}

export async function experimental_serverChannel(channel: Channel, options?: ServerChannelOptions) {
  const projectRoot = process.cwd();
  const read = createProjectReader(projectRoot);
  if (options?.presets) {
    const watcher = watchMdxSources({
      projectRoot,
      read,
      publish: (change) => {
        void applyMdxSourceChange(change).catch((error: unknown) => {
          logger.warn(`Manager docs cannot publish MDX change: ${String(error)}`);
        });
      },
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

export async function viteFinal<Config>(config: Config, options: Options): Promise<Config> {
  if (!process.env[BLOCK_BUILDER_ENV]) {
    await emitStaticComponentBlocks(options);
  }
  const viteConfig = config as Config & VitePreviewConfig;
  const launchesBlocks =
    options.configType === 'DEVELOPMENT' && !!options.channel && !process.env[BLOCK_BUILDER_ENV];
  viteConfig.plugins = [
    managerDocsMdxPlugin(),
    ...(launchesBlocks ? [componentBlocksLauncher(options)] : []),
    ...(viteConfig.plugins ?? []),
  ];
  return config;
}

type WebpackPreviewConfig = {
  module?: {
    rules?: unknown[];
  };
};

export async function webpackFinal<Config>(config: Config): Promise<Config> {
  return addMdxSourceRule(config as Config & WebpackPreviewConfig);
}
