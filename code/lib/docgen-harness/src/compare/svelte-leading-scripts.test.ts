import { describe, expect, it } from 'vitest';

import { parseSvelteSnippet } from './snippets-svelte.ts';

const scripts = [
  '',
  '<script lang="ts">let el = $state<HTMLInputElement | undefined>()</script>',
  '<script module>const title = "Example";</script>\n<script lang="ts">let el = $state<HTMLInputElement | undefined>()</script>',
];

describe('Svelte leading scripts', () => {
  it.each(scripts)('finds the component root after %s', (prefix) => {
    const root = parseSvelteSnippet(`${prefix}<Input bind:this={el} label="Name" />`);
    expect(root?.tag).toBe('Input');
    expect(root?.values.get('label')).toBe('"Name"');
    expect(root?.names.has('bind:this')).toBe(true);
  });
});
