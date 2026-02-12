import { existsSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, posix, resolve, sep, win32 } from 'node:path';

import {
  getDirectoryFromWorkingDir,
  getProjectRoot,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import { CLI_COLORS, logger, once } from 'storybook/internal/node-logger';
import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import { relative } from 'pathe';
import picocolors from 'picocolors';
import type { Polka } from 'polka';
import sirv from 'sirv';
import type { RequestHandler } from 'sirv';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../../shared/utils/module';

const cacheDir = resolvePathInStorybookCache('', 'ignored-sub').split('ignored-sub')[0];

const files = new Map<string, { data: string; mtime: number }>();
const readFileOnce = async (path: string) => {
  if (files.has(path)) {
    return files.get(path)!;
  } else {
    const [data, stats] = await Promise.all([readFile(path, 'utf-8'), stat(path)]);
    const result = { data, mtime: stats.mtimeMs };
    files.set(path, result);
    return result;
  }
};

const faviconWrapperPath = join(
  resolvePackageDir('storybook'),
  '/assets/browser/favicon-wrapper.svg'
);

export const prepareNestedSvg = (svg: string) => {
  const [, openingTag, contents, closingTag] = svg?.match(/(<svg[^>]*>)(.*?)(<\/svg>)/s) ?? [];
  if (!openingTag || !contents || !closingTag) {
    return svg;
  }

  // Extract and set width/height in the opening tag
  let width: number | undefined;
  let height: number | undefined;
  let modifiedTag = openingTag
    .replace(/width=["']([^"']*)["']/g, (_, value) => {
      width = parseFloat(value);
      return 'width="32px"';
    })
    .replace(/height=["']([^"']*)["']/g, (_, value) => {
      height = parseFloat(value);
      return 'height="32px"';
    });

  // Set a viewBox to the original dimensions
  const hasViewBox = /viewBox=["'][^"']*["']/.test(modifiedTag);
  if (!hasViewBox && width && height) {
    modifiedTag = modifiedTag.replace(/>$/, ` viewBox="0 0 ${width} ${height}">`);
  }

  // Add or replace preserveAspectRatio to center and contain the nested SVG
  modifiedTag = modifiedTag
    .replace(/preserveAspectRatio=["'][^"']*["']/g, '')
    .replace(/>$/, ' preserveAspectRatio="xMidYMid meet">');

  // Replace the original opening tag with our modified one
  return modifiedTag + contents + closingTag;
};

export async function useStatics(app: Polka, options: Options): Promise<void> {
  const staticDirs = (await options.presets.apply('staticDirs')) ?? [];
  const faviconPath = await options.presets.apply<string>('favicon');

  // Fix for serving favicon in dev mode - use the directory containing the favicon
  // rather than trying to serve the file directly
  const faviconDir = resolve(faviconPath, '..');
  const faviconFile = basename(faviconPath);
  app.use(`/${faviconFile}`, async (req, res, next) => {
    const status = req.query.status;
    if (
      status &&
      faviconFile.endsWith('.svg') &&
      ['active', 'critical', 'negative', 'positive', 'warning'].includes(status)
    ) {
      const [faviconInfo, faviconWrapperInfo] = await Promise.all([
        readFileOnce(join(faviconDir, faviconFile)),
        readFileOnce(faviconWrapperPath),
      ]).catch((e) => {
        if (e instanceof Error) {
          once.warn(`Failed to read favicon: ${e.message}`);
        }
        return [null, null];
      });

      if (faviconInfo && faviconWrapperInfo) {
        const svg = faviconWrapperInfo.data
          .replace('<g id="mask"', `<g mask="url(#${status}-mask)"`)
          .replace('<use id="status"', `<use href="#${status}"`)
          .replace('<use id="icon" />', prepareNestedSvg(faviconInfo.data));
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('ETag', `"${faviconWrapperInfo.mtime}-${faviconInfo.mtime}"`);
        res.end(svg);
        return;
      }
    }

    req.url = `/${faviconFile}`;
    return sirvMiddleware(faviconDir)(req, res, next);
  });

  for (const dir of staticDirs) {
    try {
      const { staticDir, targetEndpoint } = mapStaticDir(dir, options.configDir);

      // Don't log for internal static dirs
      if (!targetEndpoint.startsWith('/sb-') && !staticDir.startsWith(cacheDir)) {
        const relativeStaticDir = relative(getProjectRoot(), staticDir);
        logger.debug(
          `Serving static files from ${CLI_COLORS.info(relativeStaticDir)} at ${CLI_COLORS.info(targetEndpoint)}`
        );
      }
    } catch {
      // already handled in useStaticDirs
    }
  }

  useStaticDirs(staticDirs, options.configDir, (endpoint, handler) => app.use(endpoint, handler));
}

export function useStaticDirs(
  staticDirs: NonNullable<StorybookConfigRaw['staticDirs']>,
  configDir: string,
  use: (endpoint: string, handler: RequestHandler) => void
): void {
  for (const dir of staticDirs) {
    try {
      const { staticPath, targetEndpoint } = mapStaticDir(dir, configDir);

      if (existsSync(staticPath) && statSync(staticPath).isFile()) {
        // sirv doesn't support serving single files, so we need to pass the file's directory to sirv instead
        const staticPathDir = resolve(staticPath, '..');
        const staticPathFile = basename(staticPath);
        use(targetEndpoint, (req, res, next) => {
          // Rewrite the URL to match the file's name, ensuring that we only ever serve the file
          // even when sirv is passed the full directory
          req.url = `/${staticPathFile}`;
          sirvMiddleware(staticPathDir)(req, res, next);
        });
      } else {
        use(targetEndpoint, sirvMiddleware(staticPath));
      }
    } catch (e) {
      if (e instanceof Error) {
        logger.warn(e.message);
      }
    }
  }
}

/**
 * Wrapper around sirv that works around sirv breaking when serving multiple directories on the same
 * endpoint.
 *
 * @see https://github.com/lukeed/polka/issues/218
 */
export const sirvMiddleware: typeof sirv =
  (dir, opts = {}) =>
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

    sirv(dir, { dev: true, etag: true, extensions: [], ...opts })(req, res, maybeNext);
  };

export const parseStaticDir = (arg: string) => {
  // Split on last index of ':', for Windows compatibility (e.g. 'C:\some\dir:\foo')
  const lastColonIndex = arg.lastIndexOf(':');
  const isWindowsAbsolute = win32.isAbsolute(arg);
  const isWindowsRawDirOnly = isWindowsAbsolute && lastColonIndex === 1; // e.g. 'C:\some\dir'
  const splitIndex = lastColonIndex !== -1 && !isWindowsRawDirOnly ? lastColonIndex : arg.length;
  const [from, to] = [arg.slice(0, splitIndex), arg.slice(splitIndex + 1)];

  const staticDir = isAbsolute(from) ? from : `./${from}`;
  const staticPath = resolve(staticDir);

  if (!existsSync(staticPath)) {
    throw new Error(
      dedent`
        Failed to load static files, no such directory: ${picocolors.cyan(staticPath)}
        Make sure this directory exists.
      `
    );
  }

  const targetRaw = to || (statSync(staticPath).isFile() ? basename(staticPath) : '/');
  const target = targetRaw.split(sep).join(posix.sep); // Ensure target has forward-slash path
  const targetDir = target.replace(/^\/?/, './');
  const targetEndpoint = targetDir.substring(1);

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
