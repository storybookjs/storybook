import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('static Svelte internal imports', () => {
  it('keeps PreviewRender imports safe for Vite 8 dep scanning', () => {
    const previewRender = readFileSync(
      join(__dirname, '../static/PreviewRender.svelte'),
      'utf-8'
    );
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf-8')
    ) as {
      exports: Record<string, string | Record<string, string>>;
    };

    expect(previewRender).toContain(
      "from '@storybook/svelte/internal/DecoratorHandler.svelte'"
    );
    expect(packageJson.exports['./internal/DecoratorHandler.svelte']).toBe(
      './static/DecoratorHandler.svelte'
    );

    const relativeSvelteImports = [
      ...previewRender.matchAll(/from ['"](\.[^'"]+\.svelte)['"]/g),
    ];
    expect(relativeSvelteImports.map((match) => match[1])).toEqual([]);
  });
});
