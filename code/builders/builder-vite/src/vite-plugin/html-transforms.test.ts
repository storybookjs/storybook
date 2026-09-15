import { describe, expect, it } from 'vitest';

import type { DevEnvironment, Plugin, ViteDevServer } from 'vite';

import { applyStorybookEnvironmentHtmlTransforms } from './html-transforms.ts';

const BASE_HTML = `<!doctype html>
<html>
  <head></head>
  <body></body>
</html>`;

const apply = (plugins: Plugin[], html = BASE_HTML) =>
  applyStorybookEnvironmentHtmlTransforms(
    {
      plugins,
      config: { root: '/root' },
      pluginContainer: { minimalContext: {} },
    } as unknown as DevEnvironment,
    {} as ViteDevServer,
    '/__storybook/iframe.html',
    html
  );

describe('applyStorybookEnvironmentHtmlTransforms', () => {
  it('injects tags returned by an environment plugin (react preamble style)', async () => {
    const plugins: Plugin[] = [
      {
        name: 'vite:react-refresh',
        transformIndexHtml: () => [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: 'import RefreshRuntime from "/__storybook/@react-refresh";',
          },
        ],
      },
    ];

    await expect(apply(plugins)).resolves.toMatchInlineSnapshot(`
      "<!doctype html>
      <html>
        <head>
          <script type="module">import RefreshRuntime from "/__storybook/@react-refresh";</script>
      </head>
        <body></body>
      </html>"
    `);
  });

  it('skips storybook-internal plugins', async () => {
    const plugins: Plugin[] = [
      {
        name: 'storybook:code-generator-plugin',
        transformIndexHtml: (html) => html.replace('<body>', '<body>INTERNAL'),
      },
    ];

    await expect(apply(plugins)).resolves.toBe(BASE_HTML);
  });

  it('applies hooks in pre, normal, post order regardless of plugin order', async () => {
    const order: string[] = [];
    const record = (name: string) => () => {
      order.push(name);
      return undefined;
    };
    const plugins: Plugin[] = [
      { name: 'post-plugin', transformIndexHtml: { order: 'post', handler: record('post') } },
      { name: 'normal-plugin', transformIndexHtml: record('normal') },
      { name: 'pre-plugin', transformIndexHtml: { order: 'pre', handler: record('pre') } },
    ];

    await apply(plugins);

    expect(order).toEqual(['pre', 'normal', 'post']);
  });

  it('applies string results as full html replacements', async () => {
    const plugins: Plugin[] = [
      {
        name: 'string-plugin',
        transformIndexHtml: (html) => html.replace('<body>', '<body>REPLACED'),
      },
    ];

    await expect(apply(plugins)).resolves.toMatchInlineSnapshot(`
      "<!doctype html>
      <html>
        <head></head>
        <body>REPLACED</body>
      </html>"
    `);
  });

  it('supports { html, tags } results and all injectTo positions', async () => {
    const plugins: Plugin[] = [
      {
        name: 'tags-plugin',
        transformIndexHtml: (html) => ({
          html: html.replace('<body>', '<body>MAIN'),
          tags: [
            { tag: 'meta', attrs: { name: 'head-prepend' } },
            { tag: 'script', attrs: { src: '/head.js' }, injectTo: 'head' },
            { tag: 'div', children: 'body-prepend', injectTo: 'body-prepend' },
            { tag: 'script', attrs: { src: '/body.js', async: true }, injectTo: 'body' },
          ],
        }),
      },
    ];

    await expect(apply(plugins)).resolves.toMatchInlineSnapshot(`
      "<!doctype html>
      <html>
        <head>
          <meta name="head-prepend">
        <script src="/head.js"></script>
      </head>
        <body>
          <div>body-prepend</div>
      MAIN  <script src="/body.js" async></script>
      </body>
      </html>"
    `);
  });

  it('escapes attribute values when serializing tags', async () => {
    const plugins: Plugin[] = [
      {
        name: 'escape-plugin',
        transformIndexHtml: () => [
          { tag: 'meta', attrs: { content: '"quoted" & <tagged>' }, injectTo: 'head' },
        ],
      },
    ];

    await expect(apply(plugins)).resolves.toMatchInlineSnapshot(`
      "<!doctype html>
      <html>
        <head>  <meta content="&quot;quoted&quot; &amp; &lt;tagged&gt;">
      </head>
        <body></body>
      </html>"
    `);
  });

  it('returns the html untouched when no environment plugin has html hooks', async () => {
    const plugins: Plugin[] = [{ name: 'no-hook-plugin' }];

    await expect(apply(plugins)).resolves.toBe(BASE_HTML);
  });
});
