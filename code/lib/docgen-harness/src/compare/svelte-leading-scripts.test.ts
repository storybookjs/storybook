import { describe, expect, it } from 'vitest';

import { compareSvelteCaptureSnippet } from '../sandbox-baselines/svelte-rules.ts';
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

  it.each(scripts)('compares rootless markup after %s', (prefix) => {
    expect(
      compareSvelteCaptureSnippet({
        baseline: '<input aria-label="Name" />',
        candidate: `${prefix}<input aria-label="Name" />`,
        argTypes: {},
      })
    ).toEqual({ accepted: ['text-equivalent'], violations: [] });
    expect(
      compareSvelteCaptureSnippet({
        baseline: '<input aria-label="Name" />',
        candidate: `${prefix}<input aria-label="Changed" />`,
        argTypes: {},
      }).violations
    ).not.toEqual([]);
  });
});
