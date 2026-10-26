import { expect, test } from '@playwright/test';
import process from 'process';

import { checkTemplate } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const isViteSandbox = checkTemplate(
  templateName,
  (template) => template.expected.builder === '@storybook/builder-vite'
);

test.describe('static dirs', () => {
  test.skip(!isViteSandbox, 'Static dir fixtures are only generated for Vite sandboxes');

  test('serves a staticDirs entry at its configured path', async ({ request }) => {
    const response = await request.get(`${storybookUrl}/foo/from-public.txt`);

    expect(response.ok()).toBe(true);
    expect(await response.text()).toBe("from Vite's public directory");
  });

  test('serves Vite publicDir files at the root', async ({ request }) => {
    const response = await request.get(`${storybookUrl}/from-public.txt`);

    expect(response.ok()).toBe(true);
    expect(await response.text()).toBe("from Vite's public directory");
  });

  test('prefers staticDirs files over conflicting Vite publicDir files', async ({ request }) => {
    const response = await request.get(`${storybookUrl}/override.txt`);

    expect(response.ok()).toBe(true);
    expect(await response.text()).toBe('from storybook');
  });

  test('does not let a publicDir index.json replace the story index', async ({ request }) => {
    const response = await request.get(`${storybookUrl}/index.json`);

    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      v: expect.any(Number),
      entries: expect.objectContaining({
        'example-button--primary': expect.objectContaining({ type: 'story' }),
      }),
    });
  });
});
