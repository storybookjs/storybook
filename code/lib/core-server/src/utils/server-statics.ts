import { logger } from '@storybook/node-logger';
import type { Options } from '@storybook/types';
import { getDirectoryFromWorkingDir } from '@storybook/core-common';
import { ConflictingStaticDirConfigError } from '@storybook/core-events/server-errors';
import chalk from 'chalk';
import type { Router } from 'express';
import express from 'express';
import { pathExists } from 'fs-extra';
import path, { basename, isAbsolute } from 'path';
import isEqual from 'lodash/isEqual.js';

import { dedent } from 'ts-dedent';
import { defaultStaticDirs } from './constants';

export async function useStatics(router: Router, options: Options) {
  const staticDirs = (await options.presets.apply('staticDirs')) ?? [];
  const faviconPath = await options.presets.apply('favicon');

  if (options.staticDir && !isEqual(staticDirs, defaultStaticDirs)) {
    throw new ConflictingStaticDirConfigError();
  }

  const statics = [
    ...staticDirs.map((dir) => (typeof dir === 'string' ? dir : `${dir.from}:${dir.to}`)),
    ...(options.staticDir || []),
  ];

  if (statics && statics.length > 0) {
    await Promise.all(
      statics.map(async (dir) => {
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
              chalk`=> Serving static files from {cyan ${staticDir}} at {cyan ${targetEndpoint}}`
            );
          }

          router.use(targetEndpoint, express.static(staticPath, { index: false }));
        } catch (e) {
          if (e instanceof Error) logger.warn(e.message);
        }
      })
    );
  }

  router.get(`/${basename(faviconPath)}`, (req, res) => res.sendFile(faviconPath));
}

export const parseStaticDir = async (arg: string) => {
  // Split on last index of ':', for Windows compatibility (e.g. 'C:\some\dir:\foo')
  const lastColonIndex = arg.lastIndexOf(':');
  const isWindowsAbsolute = path.win32.isAbsolute(arg);
  const isWindowsRawDirOnly = isWindowsAbsolute && lastColonIndex === 1; // e.g. 'C:\some\dir'
  const splitIndex = lastColonIndex !== -1 && !isWindowsRawDirOnly ? lastColonIndex : arg.length;

  const targetRaw = arg.substring(splitIndex + 1) || '/';
  const target = targetRaw.split(path.sep).join(path.posix.sep); // Ensure target has forward-slash path

  const rawDir = arg.substring(0, splitIndex);
  const staticDir = path.isAbsolute(rawDir) ? rawDir : `./${rawDir}`;
  const staticPath = path.resolve(staticDir);
  const targetDir = target.replace(/^\/?/, './');
  const targetEndpoint = targetDir.substring(1);

  if (!(await pathExists(staticPath))) {
    throw new Error(
      dedent(chalk`
        Failed to load static files, no such directory: {cyan ${staticPath}}
        Make sure this directory exists, or omit the {bold -s (--static-dir)} option.
      `)
    );
  }

  return { staticDir, staticPath, targetDir, targetEndpoint };
};
