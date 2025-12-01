import { gunzipSync } from 'node:zlib';

import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('Sitemap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
  });

  test('should have sitemap.xml with gzipped content', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/sitemap.xml');
      const buffer = await res.arrayBuffer();
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        contentEncoding: res.headers.get('content-encoding'),
        buffer: Array.from(new Uint8Array(buffer)),
      };
    });

    expect(response.status).toBe(200);
    expect(response.contentType).toBe('application/xml');
    expect(response.contentEncoding).toBe('gzip');

    const decompressed = gunzipSync(Uint8Array.from(response.buffer)).toString('utf-8');

    expect(decompressed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(decompressed).toContain('<urlset');
    expect(decompressed).toContain('</urlset>');

    expect(decompressed).toContain('<loc>');
    expect(decompressed).toMatch(/\?path=\/docs\/example-button--docs/);
    expect(decompressed).toMatch(/\?path=\/story\/example-button--primary/);

    expect(decompressed).toContain('/?path=/settings/about');
    expect(decompressed).toContain('/?path=/settings/whats-new');
    expect(decompressed).toContain('/?path=/settings/guide');
    expect(decompressed).toContain('/?path=/settings/shortcuts');

    expect(decompressed).toContain('<lastmod>');
    expect(decompressed).toContain('<priority>');
  });
});
