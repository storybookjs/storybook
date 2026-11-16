import { readFileSync } from 'node:fs';

import type { Options } from 'storybook/internal/types';

import { afterEach, describe, expect, it } from 'vitest';

import { type Plugin, type ViteDevServer, createServer, resolveConfig } from 'vite';

import { transformIframeHtml } from '../transform-iframe-html.ts';
import { previewRuntimePath } from '../utils/preview-runtime-path.ts';
import { injectPreviewRuntimePlugin } from './inject-preview-runtime-plugin.ts';

const template = readFileSync(new URL('../../input/iframe.html', import.meta.url), 'utf-8');

const moduleScriptSources = (html: string) =>
  [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*>/g)].map(
    ([tag]) => tag.match(/\bsrc="([^"]*)"/)?.[1]
  );

const headPrependingPlugin = (order?: 'pre' | 'post', enforce?: Plugin['enforce']): Plugin => {
  const name = `third-party-${enforce ?? 'normal'}-${order ?? 'normal'}`;

  return {
    name,
    enforce,
    transformIndexHtml: {
      order,
      handler: () => [
        { tag: 'script', attrs: { type: 'module', src: `/${name}.js` }, injectTo: 'head-prepend' },
      ],
    },
  };
};

const previewHeadPlugin = (previewHead: string): Plugin => {
  const options = {
    configType: 'DEVELOPMENT',
    configDir: '/project/.storybook',
    presets: {
      apply: async (extension: string) =>
        ({ previewHead, stories: ['../src/**/*.stories.tsx'] })[extension],
    },
  } as unknown as Options;

  return {
    name: 'storybook-iframe-html',
    enforce: 'pre',
    transformIndexHtml: (html) => transformIframeHtml(html, options),
  };
};

let server: ViteDevServer | undefined;

const createDevServer = async (plugins: Plugin[], base?: string) => {
  server = await createServer({
    configFile: false,
    root: import.meta.dirname,
    base,
    logLevel: 'silent',
    appType: 'custom',
    plugins,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, ws: false, watch: null, preTransformRequests: false },
  });
  return server;
};

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('injectPreviewRuntimePlugin', () => {
  it('puts the preview runtime ahead of module scripts from previewHead and from other plugins', async () => {
    const { transformIndexHtml } = await createDevServer([
      previewHeadPlugin('<script type="module" src="/preview-head.js"></script>'),
      headPrependingPlugin('pre'),
      headPrependingPlugin(),
      headPrependingPlugin('post'),
      headPrependingPlugin('post', 'pre'),
      injectPreviewRuntimePlugin(),
    ]);

    const sources = moduleScriptSources(await transformIndexHtml('/iframe.html', template));

    expect(sources[0]).toBe('/@id/__x00__virtual:/@storybook/builder-vite/preview-runtime.js');
    expect(sources).toEqual(
      expect.arrayContaining([
        '/preview-head.js',
        '/third-party-normal-pre.js',
        '/third-party-normal-normal.js',
        '/third-party-normal-post.js',
        '/third-party-pre-post.js',
      ])
    );
  });

  it('prefixes the preview runtime script with the Vite base', async () => {
    const { transformIndexHtml } = await createDevServer(
      [injectPreviewRuntimePlugin()],
      '/__storybook/'
    );

    expect(moduleScriptSources(await transformIndexHtml('/iframe.html', template))[0]).toBe(
      '/__storybook/@id/__x00__virtual:/@storybook/builder-vite/preview-runtime.js'
    );
  });

  it('serves a script that runs the preview runtime setup', async () => {
    const { environments } = await createDevServer([injectPreviewRuntimePlugin()]);

    const loaded = await environments.client.pluginContainer.load(
      '\0virtual:/@storybook/builder-vite/preview-runtime.js'
    );

    expect(typeof loaded === 'string' ? loaded : loaded?.code).toBe(
      `import { setup } from ${JSON.stringify(previewRuntimePath)};\nsetup();`
    );
  });

  it('leaves HTML documents other than the preview iframe alone', async () => {
    const { transformIndexHtml } = await createDevServer([injectPreviewRuntimePlugin()]);

    expect(await transformIndexHtml('/index.html', template)).not.toContain('preview-runtime.js');
  });

  it('is not part of production builds', async () => {
    const { plugins } = await resolveConfig(
      { configFile: false, logLevel: 'silent', plugins: [injectPreviewRuntimePlugin()] },
      'build'
    );

    expect(plugins.map(({ name }) => name)).not.toContain(injectPreviewRuntimePlugin().name);
  });
});
