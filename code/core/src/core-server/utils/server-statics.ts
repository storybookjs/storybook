import { existsSync } from 'node:fs';
import { basename, isAbsolute, posix, resolve, sep, win32 } from 'node:path';

import { getDirectoryFromWorkingDir } from '@storybook/core/common';
import type { Options, StorybookConfigRaw } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import picocolors from 'picocolors';
import type Polka from 'polka';
import sirv from 'sirv';
import { dedent } from 'ts-dedent';

export async function useStatics(app: Polka.Polka, options: Options): Promise<void> {
  const staticDirs = (await options.presets.apply('staticDirs')) ?? [];
  const faviconPath = await options.presets.apply<string>('favicon');

  staticDirs.map((dir) => {
    try {
      const { staticDir, staticPath, targetEndpoint } = mapStaticDir(dir, options.configDir);

      // Don't log for the internal static dir
      if (!targetEndpoint.startsWith('/sb-')) {
        logger.info(
          `=> Serving static files from ${picocolors.cyan(staticDir)} at ${picocolors.cyan(targetEndpoint)}`
        );
      }

      app.use(
        targetEndpoint,
        sirv(staticPath, {
          dev: true,
          etag: true,
          extensions: [],
        })
      );
    } catch (e) {
      if (e instanceof Error) {
        logger.warn(e.message);
      }
    }
  });

  app.get(
    `/${basename(faviconPath)}`,
    sirv(faviconPath, {
      dev: true,
      etag: true,
      extensions: [],
    })
  );
}

export const parseStaticDir = (arg: string) => {
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

  if (!existsSync(staticPath)) {
    throw new Error(
      dedent`
        Failed to load static files, no such directory: ${picocolors.cyan(staticPath)}
        Make sure this directory exists.
      `
    );
  }

  return { staticDir, staticPath, targetDir, targetEndpoint };
};

export const mapStaticDir = (
  staticDir: NonNullable<StorybookConfigRaw['staticDirs']>[number],
  configDir: string
) => {
  const specifier = typeof staticDir === 'string' ? staticDir : `${staticDir.from}:${staticDir.to}`;
  const normalizedDir = isAbsolute(specifier)
    ? specifier
    : getDirectoryFromWorkingDir({ configDir, workingDir: process.cwd(), directory: specifier });

  return parseStaticDir(normalizedDir);
};
