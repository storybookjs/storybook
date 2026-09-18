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

const renderManagerHtml = (customHead = '') =>
  renderHTML(
    Promise.resolve(template),
    Promise.resolve('Example'),
    Promise.resolve('favicon.svg'),
    Promise.resolve(customHead),
    [],
    [],
    Promise.resolve({}),
    Promise.resolve({}),
    Promise.resolve('info'),
    Promise.resolve({}),
    Promise.resolve({}),
    {
      versionCheck: undefined,
      previewUrl: undefined,
      configType: 'DEVELOPMENT',
      ignorePreview: false,
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
