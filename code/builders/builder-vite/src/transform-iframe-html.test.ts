import { readFileSync } from 'node:fs';

import type { Options, SecurityConfig } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import { transformIframeHtml } from './transform-iframe-html.ts';

const TEMPLATE = readFileSync(new URL('../input/iframe.html', import.meta.url), 'utf-8');

const HTML = `<script type="module" src="virtual:/@storybook/builder-vite/vite-app.js"></script>
<!-- [HEAD HTML SNIPPET HERE] -->`;

const createSecurityOptions = (security?: SecurityConfig): Options =>
  ({
    configType: 'PRODUCTION',
    configDir: '/project/.storybook',
    presets: {
      apply: async (extension: string) =>
        ({ security, stories: ['../src/**/*.stories.tsx'] })[extension],
    },
  }) as unknown as Options;

function createOptions(configType: Options['configType']): Options {
  const values: Record<string, unknown> = { stories: ['../src/**/*.stories.ts'] };

  return {
    configType,
    features: {},
    configDir: '/project/.storybook',
    presets: {
      apply: async (key: string) => values[key],
    },
  } as unknown as Options;
}

describe('transformIframeHtml', () => {
  it('flags the preview when security.insecureIframeMessaging is enabled', async () => {
    const html = await transformIframeHtml(
      TEMPLATE,
      createSecurityOptions({ insecureIframeMessaging: true })
    );

    expect(html).toContain('window["INSECURE_IFRAME_MESSAGING"] = true;');
  });

  it('leaves the preview unflagged by default', async () => {
    const html = await transformIframeHtml(TEMPLATE, createSecurityOptions());

    expect(html).not.toContain('INSECURE_IFRAME_MESSAGING');
  });

  it.each<{
    name: string;
    configType: Options['configType'];
    base?: string;
    expected: string;
  }>([
    {
      name: 'dev at root',
      configType: 'DEVELOPMENT',
      expected:
        '<script type="module" src="/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"></script>\n',
    },
    {
      name: 'dev under a mounted base',
      configType: 'DEVELOPMENT',
      base: '/__storybook/',
      expected:
        '<script type="module" src="/__storybook/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"></script>\n',
    },
    {
      name: 'production leaves the virtual id alone',
      configType: 'PRODUCTION',
      base: '/__storybook/',
      expected:
        '<script type="module" src="virtual:/@storybook/builder-vite/vite-app.js"></script>\n',
    },
  ])('$name', async ({ configType, base, expected }) => {
    expect(await transformIframeHtml(HTML, createOptions(configType), base)).toBe(expected);
  });
});
