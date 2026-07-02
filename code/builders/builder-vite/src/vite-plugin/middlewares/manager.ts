import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import { dirname, join } from 'pathe';
import sirv from 'sirv';

import {
  buildFrameworkGlobalsFromOptions,
  readTemplate,
  renderHTML,
} from 'storybook/internal/builder-manager';

const storybookPackageDir = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
const CORE_MANAGER_DIR = join(storybookPackageDir, 'dist/manager');

export async function buildManager(
  options: Options,
  basePath: string,
  channelPath: string
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

  const globals: Record<string, any> = await buildFrameworkGlobalsFromOptions(options);

  if (globals.CHANNEL_OPTIONS) {
    globals.CHANNEL_OPTIONS.channelPath = channelPath;
  } else {
    globals.CHANNEL_OPTIONS = { channelPath };
  }

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
      previewUrl: `${basePath}iframe.html`,
    },
    globals
  );

  return html;
}

/** Serves the prebuilt manager UI assets; expects req.url relative to the sb-manager mount. */
export function createManagerAssetsHandler() {
  return sirv(CORE_MANAGER_DIR, {
    maxAge: 300000,
    dev: true,
    immutable: true,
  });
}
