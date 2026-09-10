import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import { dirname, join, parse } from 'pathe';
import sirv from 'sirv';

import {
  buildFrameworkGlobalsFromOptions,
  executor,
  getConfig,
  readOrderedFiles,
  readTemplate,
  renderHTML,
} from 'storybook/internal/builder-manager';
import { logger } from 'storybook/internal/node-logger';

const storybookPackageDir = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
const CORE_MANAGER_DIR = join(storybookPackageDir, 'dist/manager');

async function compileManagerEntries(
  options: Options,
  addonsDir: string
): Promise<{ cssFiles: string[]; jsFiles: string[] }> {
  // clear stale bundles so removed addons don't linger, then ensure the dir exists so the
  // sb-addons static handler can always be mounted (even if compilation below fails)
  await rm(addonsDir, { recursive: true, force: true });
  await mkdir(addonsDir, { recursive: true });

  try {
    const [config, build] = await Promise.all([getConfig(options), executor.get()]);
    const compilation = await build({ ...config, outdir: addonsDir });

    return await readOrderedFiles(addonsDir, compilation?.outputFiles);
  } catch (error) {
    logger.error('Failed to compile Storybook addon manager entries; addons will not load.');
    logger.error(String(error));
    return { cssFiles: [], jsFiles: [] };
  }
}

export async function buildManager(
  options: Options,
  basePath: string,
  channelPath: string | undefined,
  addonsDir: string
): Promise<string> {
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

  const globals: Record<string, unknown> & {
    CHANNEL_OPTIONS?: { channelPath?: string };
  } = await buildFrameworkGlobalsFromOptions(options);

  if (channelPath) {
    if (globals.CHANNEL_OPTIONS) {
      globals.CHANNEL_OPTIONS.channelPath = channelPath;
    } else {
      globals.CHANNEL_OPTIONS = { channelPath };
    }
  }

  const { cssFiles, jsFiles } = await compileManagerEntries(options, addonsDir);

  const html = await renderHTML(
    template,
    title,
    favicon,
    customHead,
    cssFiles,
    jsFiles,
    features,
    refs,
    logLevel,
    docsOptions,
    tagsOptions,
    {
      ...options,
      previewUrl: `${basePath}iframe.html`,
    },
    globals
  );

  return html;
}

export async function copyManagerAssets(outputDir: string): Promise<void> {
  await cp(CORE_MANAGER_DIR, join(outputDir, 'sb-manager'), {
    filter: (src) => {
      const { ext } = parse(src);
      return !ext || ext === '.js';
    },
    recursive: true,
  });
}

/** Serves the prebuilt manager UI assets; expects req.url relative to the sb-manager mount. */
export function createManagerAssetsHandler() {
  return sirv(CORE_MANAGER_DIR, {
    maxAge: 300000,
    dev: true,
    immutable: true,
  });
}

export function createAddonsAssetsHandler(addonsDir: string) {
  return sirv(addonsDir, {
    maxAge: 300000,
    dev: true,
    immutable: true,
  });
}
