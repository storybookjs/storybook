import { access, readFile } from 'fs/promises';

import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import { join } from 'pathe';
import type { Connect, DevEnvironment, ViteDevServer } from 'vite';

import { renderIframeHtml } from './iframe.ts';
import { createManagerAssetsHandler } from './manager.ts';

const knownJsSrcRE = /\.(?:[jt]sx?|m[jt]s|vue|marko|svelte|astro|imba|mdx?)(?:$|\?)/;
const cssLangsRE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const importQueryRE = /(\?|&)import=?(?:&|$)/;
const htmlProxyRE = /(\?|&)html-proxy\b/;

function isTransformableRequest(url: string): boolean {
  const clean = url.split('?')[0];
  if (knownJsSrcRE.test(clean) || cssLangsRE.test(clean)) {
    return true;
  }
  if (importQueryRE.test(url) || htmlProxyRE.test(url)) {
    return true;
  }
  return !/\.\w+$/.test(clean) && !clean.endsWith('/');
}

function runHandlerChain(
  handlers: Connect.NextHandleFunction[],
  req: Parameters<Connect.NextHandleFunction>[0],
  res: Parameters<Connect.NextHandleFunction>[1]
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const onFinish = () => resolve(false);
    res.once('finish', onFinish);
    let i = 0;
    const step = (err?: unknown): void => {
      if (err) {
        res.off('finish', onFinish);
        return reject(err);
      }
      const handler = handlers[i++];
      if (!handler) {
        res.off('finish', onFinish);
        return resolve(true);
      }
      handler(req, res, step);
    };
    step();
  });
}

export interface StorybookMiddlewareOptions {
  options: Options;
  basePath: string;
  managerHtml: string;
  storyIndexGenerator: StoryIndexGenerator;
  staticHandlers: Connect.NextHandleFunction[];
  proxy: Connect.NextHandleFunction;
}

export function registerStorybookMiddleware(
  server: ViteDevServer,
  middlewareOptions: StorybookMiddlewareOptions
) {
  server.middlewares.use(createStorybookMiddleware(server, middlewareOptions));
}

function createStorybookMiddleware(
  server: ViteDevServer,
  {
    options,
    basePath,
    managerHtml,
    storyIndexGenerator,
    staticHandlers,
    proxy,
  }: StorybookMiddlewareOptions
): Connect.NextHandleFunction {
  const DEPS_STORYBOOK_PREFIX = '/node_modules/.cache/storybook-vite-deps/deps/';
  const prefix = basePath.replace(/\/+$/, '');
  const managerAssets = createManagerAssetsHandler();

  return async (req, res, next) => {
    const originalUrl = req.url;
    if (!originalUrl || !(originalUrl === prefix || originalUrl.startsWith(prefix + '/'))) {
      return next();
    }
    const url = originalUrl.slice(prefix.length) || '/';
    const pathname = url.split('?')[0];

    try {
      // static dirs first, matching the pre-dispatch middleware order
      if (staticHandlers.length > 0) {
        req.url = url;
        const passedThrough = await runHandlerChain(staticHandlers, req, res);
        if (!passedThrough) {
          return;
        }
        req.url = originalUrl;
      }

      if (pathname === '/index.json') {
        const index = await storyIndexGenerator.getIndex();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(index));
        return;
      }

      if (pathname === '' || pathname === '/' || pathname === '/index.html') {
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.end(managerHtml);
        return;
      }

      if (pathname.startsWith('/sb-manager/')) {
        req.url = url.slice('/sb-manager'.length) || '/';
        managerAssets(req, res, () => {
          req.url = originalUrl;
          res.statusCode = 404;
          res.end();
        });
        return;
      }

      if (pathname === '/iframe.html') {
        const html = await renderIframeHtml(server, options, basePath);
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        res.end(html);
        return;
      }

      if (pathname.startsWith(DEPS_STORYBOOK_PREFIX)) {
        try {
          const content = await readFile(join(server.config.root, pathname));
          const isMap = pathname.endsWith('.map');
          res.setHeader('Content-Type', isMap ? 'application/json' : 'application/javascript');
          res.setHeader('Cache-Control', 'max-age=31536000, immutable');
          res.statusCode = 200;
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end();
        }
        return;
      }

      const storybookEnv = server.environments.storybook as DevEnvironment | undefined;

      if (storybookEnv && isTransformableRequest(url)) {
        let moduleUrl = url;

        if (
          moduleUrl.startsWith('/') &&
          !moduleUrl.startsWith('/@') &&
          !moduleUrl.startsWith('/node_modules')
        ) {
          const bare = moduleUrl.slice(1);
          if (bare.includes(':')) {
            moduleUrl = bare;
          }
        }

        if (moduleUrl.startsWith('/@id/__x00__')) {
          moduleUrl = '\0' + moduleUrl.slice('/@id/__x00__'.length);
        } else if (moduleUrl.startsWith('/@id/')) {
          moduleUrl = moduleUrl.slice('/@id/'.length);
        }

        const result = await storybookEnv.transformRequest(moduleUrl);
        if (result) {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          if (result.etag) {
            res.setHeader('ETag', result.etag);
          }
          res.statusCode = 200;
          res.end(result.code);
          return;
        }
      } else if (pathname.startsWith('/@fs/')) {
        // raw file request — the host's /@fs middleware serves it from the shared filesystem
        req.url = url;
        return next();
      } else {
        try {
          await access(join(server.config.root, pathname));
          // a project file — the host's static middlewares serve it from the shared root
          req.url = url;
          return next();
        } catch {
          // not a file — fall through to the dev-server proxy
        }
      }

      req.url = originalUrl;
      proxy(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
