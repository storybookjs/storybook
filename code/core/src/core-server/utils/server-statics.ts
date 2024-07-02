import { logger } from '@storybook/core/node-logger';
import type { Options } from '@storybook/core/types';
import { getDirectoryFromWorkingDir } from '@storybook/core/common';
import chalk from 'chalk';
import type { Server } from './server-connect';
import { pathExists } from 'fs-extra';
import { basename, isAbsolute, normalize, posix, relative, resolve, sep, win32 } from 'node:path';
import sirv from 'sirv';
import type { ServerResponse } from 'http';

import { dedent } from 'ts-dedent';

// TODO (43081j): maybe get this from somewhere?
const contentTypes: Record<string, string> = {
  css: 'text/css',
  woff2: 'font/woff2',
  js: 'text/javascript',
};
const setContentTypeHeaders = (res: ServerResponse, pathname: string) => {
  const base = basename(pathname);
  const contentType = contentTypes[base];
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
};

export async function useStatics(app: Server, options: Options): Promise<void> {
  const staticDirs = (await options.presets.apply('staticDirs')) ?? [];
  const faviconPath = await options.presets.apply<string>('favicon');

  const statics: Array<{ targetEndpoint: string; staticPath: string }> = [];
  const userStatics = [
    `${faviconPath}:/${basename(faviconPath)}`,
    ...staticDirs.map((dir) => (typeof dir === 'string' ? dir : `${dir.from}:${dir.to}`)),
  ];

  for (const dir of userStatics) {
    try {
      const normalizedDir =
        staticDirs && !isAbsolute(dir)
          ? getDirectoryFromWorkingDir({
              configDir: options.configDir,
              workingDir: process.cwd(),
              directory: dir,
            })
          : dir;
      const { staticDir, staticPath, targetEndpoint } = await parseStaticDir(normalizedDir);

      // Don't log for the internal static dir
      if (!targetEndpoint.startsWith('/sb-')) {
        logger.info(
          `=> Serving static files from ${chalk.cyan(staticDir)} at ${chalk.cyan(targetEndpoint)}`
        );
      }

      statics.push({ targetEndpoint, staticPath });
    } catch (e) {
      if (e instanceof Error) logger.warn(e.message);
    }
  }

  const serve = sirv(process.cwd(), {
    dev: true,
    etag: true,
    setHeaders: setContentTypeHeaders,
  });

  app.use((req, res, next) => {
    if (!req.url) {
      return next();
    }

    const url = new URL(req.url, 'https://storybook.js.org');
    const pathname = normalize(url.pathname);

    // TODO (43081j): this is 'security' so you can't break out of cwd
    // Probably need to do something better here
    if (pathname.startsWith('..') || pathname.endsWith('/')) {
      return next();
    }

    for (const { targetEndpoint, staticPath } of statics) {
      if (pathname.startsWith(targetEndpoint)) {
        // TODO (43081j): similar as above, this might be doable in a cleaner way
        const newPath = relative(
          process.cwd(),
          resolve(staticPath, './' + pathname.slice(targetEndpoint.length))
        );
        url.pathname = newPath;
        req.url = url.href.slice(url.origin.length);
        serve(req, res, next);
        return;
      }
    }

    next();
  });
}

export const parseStaticDir = async (arg: string) => {
  // Split on last index of ':', for Windows compatibility (e.g. 'C:\some\dir:\foo')
  const lastColonIndex = arg.lastIndexOf(':');
  const isWindowsAbsolute = win32.isAbsolute(arg);
  const isWindowsRawDirOnly = isWindowsAbsolute && lastColonIndex === 1; // e.g. 'C:\some\dir'
  const splitIndex = lastColonIndex !== -1 && !isWindowsRawDirOnly ? lastColonIndex : arg.length;

  const targetRaw = arg.substring(splitIndex + 1) || '/';
  const target = targetRaw.split(sep).join(posix.sep); // Ensure target has forward-slash path

  const rawDir = arg.substring(0, splitIndex);
  const staticDir = isAbsolute(rawDir) ? rawDir : `./${rawDir}`;
  const staticPath = resolve(staticDir);
  const targetDir = target.replace(/^\/?/, './');
  const targetEndpoint = targetDir.substring(1);

  if (!(await pathExists(staticPath))) {
    throw new Error(
      dedent`
        Failed to load static files, no such directory: ${chalk.cyan(staticPath)}
        Make sure this directory exists.
      `
    );
  }

  return { staticDir, staticPath, targetDir, targetEndpoint };
};
