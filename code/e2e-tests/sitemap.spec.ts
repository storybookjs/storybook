import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('Sitemap', () => {
  test('should have sitemap.xml with gzipped content', async ({ page }) => {
    const response = await page.goto(`${storybookUrl}/sitemap.xml`);

    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toBe('application/xml');
    expect(response?.headers()['content-encoding']).toBe('gzip');

    const decompressed = (await response?.body())?.toString('utf-8');
    expect(decompressed).toBeDefined();

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
