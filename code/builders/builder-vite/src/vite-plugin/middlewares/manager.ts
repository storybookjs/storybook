import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import { dirname, join } from 'pathe';
import sirv from 'sirv';
import type { Connect, ViteDevServer } from 'vite';

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

export function registerManagerMiddleware(
  server: ViteDevServer,
  managerHtml: string,
  basePath: string
) {
  const basePathNoSlash = basePath.replace(/\/$/, '');
  const managerIndexPath = `${basePath}index.html`;

  const managerHtmlMiddleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url) {
      return next();
    }
    const pathname = req.url.split('?')[0];
    if (pathname === basePathNoSlash || pathname === basePath || req.url === managerIndexPath) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write(managerHtml);
      res.end();
    } else {
      next();
    }
  };

  const sbManagerPath = `${basePath}sb-manager`;
  const sbManagerHandler = sirv(CORE_MANAGER_DIR, {
    maxAge: 300000,
    dev: true,
    immutable: true,
  });
  const sbManagerMiddleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith(sbManagerPath)) {
      return next();
    }
    req.url = req.url.slice(sbManagerPath.length) || '/';
    sbManagerHandler(req, res, next);
  };

  server.middlewares.use(managerHtmlMiddleware);
  server.middlewares.use(sbManagerMiddleware);
}
