import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { customHeadHasFavicon, renderHTML } from './template.ts';

const template = `
<head>
<% if (favicon.endsWith('.svg')) {%>
<link rel="icon" type="image/svg+xml" href="./<%= favicon %>" />
<% } else if (favicon.endsWith('.ico')) { %>
<link rel="icon" type="image/x-icon" href="./<%= favicon %>" />
<% } %>
<% if (typeof head !== 'undefined') { %><%- head %><% } %>
</head>
`;

const renderManagerHtml = (
  customHead = '',
  jsFiles: string[] = [],
  source = Promise.resolve(template)
) =>
  renderHTML(
    source,
    Promise.resolve('Example'),
    Promise.resolve('favicon.svg'),
    Promise.resolve(customHead),
    [],
    jsFiles,
    Promise.resolve({}),
    Promise.resolve({}),
    Promise.resolve('info'),
    Promise.resolve({}),
    Promise.resolve({}),
    {
      versionCheck: undefined,
      configType: 'DEVELOPMENT',
    } as Options,
    {}
  );

it('renders the default manager favicon when custom head does not provide one', async () => {
  const html = await renderManagerHtml('<link rel="stylesheet" href="./manager.css" />');

  expect(html).toContain('href="./favicon.svg"');
  expect(html).toContain('href="./manager.css"');
});

it('does not render the default manager favicon when custom head provides an icon', async () => {
  const html = await renderManagerHtml('<link rel="icon" type="image/png" href="./ui.png" />');

  expect(html).not.toContain('href="./favicon.svg"');
  expect(html).toContain('href="./ui.png"');
});

it('detects shortcut icon links without treating touch icons as favicons', () => {
  expect(customHeadHasFavicon('<link rel="shortcut icon" href="./favicon.ico" />')).toBe(true);
  expect(customHeadHasFavicon('<link rel="apple-touch-icon" href="./touch.png" />')).toBe(false);
});

it('loads each manager entry in a module script of its own, between the globals and the runtime', async () => {
  const html = await renderManagerHtml(
    '',
    ['./sb-addons/a/manager-bundle.js', './sb-addons/b/manager-bundle.js'],
    readFile(join(import.meta.dirname, '../../../assets/server/template.ejs'), 'utf8')
  );

  expect(html.match(/<script type="module"[^>]*>/g)).toEqual([
    '<script type="module" src="./sb-manager/globals-runtime.js">',
    '<script type="module" src="./sb-addons/a/manager-bundle.js">',
    '<script type="module" src="./sb-addons/b/manager-bundle.js">',
    '<script type="module" src="./sb-manager/runtime.js">',
  ]);
});
