import { existsSync, statSync } from 'node:fs';
import { basename, isAbsolute, posix, resolve, sep, win32 } from 'node:path';

import { getDirectoryFromWorkingDir, resolvePathInStorybookCache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import type { Polka } from 'polka';
import sirv from 'sirv';
import { dedent } from 'ts-dedent';

const cacheDir = resolvePathInStorybookCache('', 'ignored-sub').split('ignored-sub')[0];

export async function useStatics(app: Polka, options: Options): Promise<void> {
  const staticDirs = (await options.presets.apply('staticDirs')) ?? [];
  const faviconPath = await options.presets.apply<string>('favicon');

  staticDirs.map((dir) => {
    try {
      const { staticDir, staticPath, targetEndpoint } = mapStaticDir(dir, options.configDir);

      // Don't log for internal static dirs
      if (!targetEndpoint.startsWith('/sb-') && !staticDir.startsWith(cacheDir)) {
        logger.info(
          `=> Serving static files from ${picocolors.cyan(staticDir)} at ${picocolors.cyan(targetEndpoint)}`
        );
      }

      if (existsSync(staticPath) && statSync(staticPath).isFile()) {
        // sirv doesn't support serving single files, so we need to pass the file's directory to sirv instead
        const staticPathDir = resolve(staticPath, '..');
        const staticPathFile = basename(staticPath);
        app.use(targetEndpoint, (req, res, next) => {
          // Rewrite the URL to match the file's name, ensuring that we only ever serve the file
          // even when sirv is passed the full directory
          req.url = `/${staticPathFile}`;
          sirvWorkaround(staticPathDir, {
            dev: true,
            etag: true,
            extensions: [],
          })(req, res, next);
        });
        return;
      }
      app.use(
        targetEndpoint,
        sirvWorkaround(staticPath, {
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

  // Fix for serving favicon in dev mode - use the directory containing the favicon
  // rather than trying to serve the file directly
  const faviconDir = resolve(faviconPath, '..');
  const faviconFile = basename(faviconPath);
  app.use('/', (req, res, next) => {
    if (req.url === `/${faviconFile}`) {
      return sirvWorkaround(faviconDir, {
        dev: true,
        etag: true,
        extensions: [],
      })(req, res, next);
    }
    next();
  });
}

/**
 * This is a workaround for sirv breaking when serving multiple directories on the same endpoint.
 *
 * @see https://github.com/lukeed/polka/issues/218
 */
const sirvWorkaround: typeof sirv =
  (...sirvArgs) =>
  (req, res, next) => {
    // polka+sirv will modify the request URL, so we need to restore it after sirv is done
    // req._parsedUrl is an internal construct used by both polka and sirv
    const originalParsedUrl = (req as any)._parsedUrl;

    const maybeNext = next
      ? () => {
          (req as any)._parsedUrl = originalParsedUrl;
          next();
        }
      : undefined;

    sirv(...sirvArgs)(req, res, maybeNext);
  };

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
