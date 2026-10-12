import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Options, SecurityConfig } from 'storybook/internal/types';

import { transformIframeHtml } from './transform-iframe-html';

const template = readFileSync(join(__dirname, '../input/iframe.html'), 'utf-8');

const createOptions = (security?: SecurityConfig) =>
  ({
    configType: 'PRODUCTION',
    configDir: '/project/.storybook',
    presets: {
      apply: async (extension: string) =>
        ({ security, stories: ['../src/**/*.stories.tsx'] })[extension],
    },
  }) as unknown as Options;

describe('transformIframeHtml', () => {
  it('flags the preview when security.insecureIframeMessaging is enabled', async () => {
    const html = await transformIframeHtml(
      template,
      createOptions({ insecureIframeMessaging: true })
    );

    expect(html).toContain('window["INSECURE_IFRAME_MESSAGING"] = true;');
  });

  it('leaves the preview unflagged by default', async () => {
    const html = await transformIframeHtml(template, createOptions());

    expect(html).not.toContain('INSECURE_IFRAME_MESSAGING');
  });
});
