import { lstat, link, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { DesignExportError } from 'storybook/internal/server-errors';
import { logger } from 'storybook/internal/node-logger';

import { strToU8, zipSync } from 'fflate';
import { dirname, join, resolve } from 'pathe';
import type { Browser, BrowserContext } from 'playwright';

import { captureStory } from './capture.ts';
import {
  buildDesignFiles,
  readStoryIndex,
  validatePreviewVersion,
  type CapturedStory,
} from './format.ts';
import type { ExportOptions } from './register.ts';
import { createResources, MAX_EXPORT_BYTES } from './resources.ts';

export async function writeArchive(
  outputFile: string,
  files: Record<string, Uint8Array>,
  signal?: AbortSignal
): Promise<void> {
  const size = Object.values(files).reduce((total, value) => total + value.byteLength, 0);
  if (size > MAX_EXPORT_BYTES) {
    throw new DesignExportError({
      message: 'Export exceeds 256 MiB. Reduce the library or its asset sizes.',
    });
  }
  signal?.throwIfAborted();
  const archive = zipSync(files, { level: 6, mtime: new Date(2000, 0, 1) });
  const directory = await mkdtemp(join(dirname(outputFile), '.storybook-export-'));
  let published = false;
  try {
    const temporary = join(directory, 'library.zip');
    await writeFile(temporary, archive, { flag: 'wx', signal });
    signal?.throwIfAborted();
    await link(temporary, outputFile);
    published = true;
  } finally {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      if (!published) {
        throw error;
      }
      logger.warn(
        `Export succeeded, but could not remove temporary directory ${directory}: ${String(error)}`
      );
    }
  }
}

export async function runExport(options: ExportOptions, signal?: AbortSignal): Promise<void> {
  const outputFile = resolve(options.outputFile);
  try {
    await lstat(outputFile);
    throw new DesignExportError({
      message: `Output already exists: ${outputFile}. Choose a new --output-file.`,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  signal?.throwIfAborted();
  const require = createRequire(resolve('package.json'));
  let playwright: typeof import('playwright');
  try {
    playwright = require('playwright');
  } catch {
    throw new DesignExportError({
      message:
        'Export requires Playwright in your project. Install playwright, then run `npx playwright install chromium`.',
    });
  }
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let closing: Promise<void> | undefined;
  const close = () => {
    if (browser) {
      closing ??= Promise.allSettled([context?.request.dispose(), browser.close()]).then(
        (results) => {
          for (const result of results) {
            if (result.status === 'rejected') {
              throw result.reason;
            }
          }
        }
      );
    }
    return closing;
  };
  const cancel = () => {
    void close()?.catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    browser = await playwright.chromium.launch({ timeout: options.timeout });
    signal?.throwIfAborted();
    context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    const base = new URL(options.url);
    const metadata = await context.request.get(new URL('project.json', base).href, {
      timeout: options.timeout,
    });
    try {
      if (!metadata.ok()) {
        throw new DesignExportError({
          message:
            'Cannot read project.json. Serve the target Storybook metadata to verify that play functions can be disabled.',
        });
      }
      validatePreviewVersion(await metadata.json());
    } finally {
      await metadata.dispose();
    }
    const response = await context.request.get(new URL('index.json', base).href, {
      timeout: options.timeout,
    });
    let stories;
    try {
      if (!response.ok()) {
        throw new DesignExportError({
          message: `Storybook index returned HTTP ${response.status()}. Check --url.`,
        });
      }
      stories = readStoryIndex(await response.json());
    } finally {
      await response.dispose();
    }
    const resources = createResources(context.request, options.timeout);
    const captures: CapturedStory[] = [];
    for (const story of stories) {
      signal?.throwIfAborted();
      logger.info(`Exporting ${story.title} / ${story.name}`);
      const page = await context.newPage();
      let timedOut = false;
      let pageClosing: Promise<void> | undefined;
      const timer = setTimeout(() => {
        timedOut = true;
        pageClosing = close();
        void pageClosing?.catch(() => {});
      }, options.timeout);
      try {
        captures.push(await captureStory(page, story, base, resources, options.timeout));
        signal?.throwIfAborted();
        if (timedOut) {
          throw new DesignExportError({ message: 'Timed out' });
        }
      } catch (error) {
        signal?.throwIfAborted();
        throw new DesignExportError({
          message: `Could not export ${story.id}: ${timedOut ? `exceeded ${options.timeout} ms; increase --timeout or fix the story` : String(error)}`,
          cause: error,
        });
      } finally {
        clearTimeout(timer);
        await (pageClosing ?? page.close());
      }
    }
    await close();
    const files = Object.fromEntries(
      Object.entries(buildDesignFiles(captures)).map(([file, text]) => [file, strToU8(text)])
    );
    await writeArchive(outputFile, { ...files, ...resources.assets }, signal);
    logger.info(`Exported ${captures.length} editable artboards to ${outputFile}`);
  } finally {
    signal?.removeEventListener('abort', cancel);
    await close();
  }
}
