import { SandboxBaselineError } from '../error.ts';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { once } from 'node:events';

import { chromium } from 'playwright';

import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import type { Channel } from 'storybook/internal/channels';

import type { CapturedComponents } from './types.ts';

import { readCaptureIndex } from './read-index.ts';

declare global {
  interface Window {
    __DOCGEN_CAPTURE_SNIPPETS__: Record<string, string>;
  }
}

export async function captureLegacy({
  staticDir,
  snippetTimeout,
}: {
  staticDir: string;
  snippetTimeout: number;
}): Promise<CapturedComponents> {
  const root = resolve(staticDir);
  const { entries, selected } = readCaptureIndex(root);
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
  };
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const path = relative(root, file);
    if (path.startsWith(`..${sep}`) || path === '..') {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    const stream = createReadStream(file);
    stream.on('error', () => response.writeHead(404).end());
    stream.pipe(response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new SandboxBaselineError('No static server port');
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.addInitScript(
        ({ event }) => {
          window.__DOCGEN_CAPTURE_SNIPPETS__ = {};
          let channel: Channel | undefined;
          Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
            configurable: true,
            get: () => channel,
            set: (value: Channel) => {
              channel = value;
              value.on(event, (payload: { id: string; source?: string }) => {
                if (typeof payload.source === 'string')
                  window.__DOCGEN_CAPTURE_SNIPPETS__[payload.id] = payload.source;
              });
            },
          });
        },
        { event: SNIPPET_RENDERED }
      );
      const components: CapturedComponents = {};
      const url = `http://127.0.0.1:${address.port}/iframe.html`;
      for (const [id, entry] of selected) {
        await page.goto(url);
        await page.waitForFunction(
          () => typeof globalThis.__STORYBOOK_PREVIEW__?.ready === 'function'
        );
        const component = await page.evaluate(
          async ({ storyId, storyImportPath, title }) => {
            const preview = globalThis.__STORYBOOK_PREVIEW__;
            await preview.ready();
            const store = preview.storyStore;
            const file = storyImportPath
              ? store.processCSFFileWithCache(
                  await store.importFn(storyImportPath),
                  storyImportPath,
                  title
                )
              : await store.loadCSFFileByStoryId(storyId);
            const meta = preview.storyStore.preparedMetaFromCSFFile({ csfFile: file });
            const docs = meta.parameters?.docs;
            return {
              name: meta.component?.name ?? meta.title,
              description: docs?.extractComponentDescription?.(meta.component),
              argTypes: docs?.extractArgTypes?.(meta.component) ?? {},
            };
          },
          {
            storyId: entry.id,
            storyImportPath: entry.type === 'docs' ? entry.storiesImports[0] : undefined,
            title: entry.title,
          }
        );
        const stories: CapturedComponents[string]['stories'] = {};
        for (const story of entries.filter(
          (item) =>
            item.type === 'story' && item.subtype === 'story' && item.id.split('--')[0] === id
        )) {
          await page.goto(`${url}?id=${encodeURIComponent(story.id)}&viewMode=story`);
          try {
            await page.waitForFunction(
              (storyId) => Object.hasOwn(window.__DOCGEN_CAPTURE_SNIPPETS__, storyId),
              story.id,
              { timeout: snippetTimeout }
            );
            stories[story.id] = {
              snippet: await page.evaluate(
                (storyId) => window.__DOCGEN_CAPTURE_SNIPPETS__[storyId],
                story.id
              ),
            };
          } catch (error) {
            if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
            stories[story.id] = { snippet: 'timeout' };
          }
        }
        components[id] = { id, ...component, stories };
      }
      return components;
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done()))
    );
  }
}
