import { describe, expect, it } from 'vitest';

import { compareSvelteCaptureSnippet } from './svelte-rules.ts';
import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';

const compare = (baseline: string, candidate: string, argTypes: StrictArgTypes = {}) =>
  compareSvelteCaptureSnippet({ baseline, candidate, argTypes });

describe('counted Svelte capture rules', () => {
  it('accepts equivalent rootless text and rejects changed text', () => {
    expect(compare('hello   world', '<script>let x = 1;</script>hello world')).toEqual({
      accepted: ['text-equivalent'],
      violations: [],
    });
    expect(compare('hello', 'goodbye').violations).not.toEqual([]);
    expect(compare('<Button/>', 'hello').violations).not.toEqual([]);
  });

  it('accepts a named snippet child and rejects a differently named child', () => {
    expect(
      compare('<Button children={w}/>', '<Button>{#snippet children()}hi{/snippet}</Button>')
    ).toEqual({
      accepted: ['snippet-child'],
      violations: [],
    });
    expect(
      compare('<Button children={w}/>', '<Button>{#snippet footer()}hi{/snippet}</Button>')
        .violations
    ).not.toEqual([]);
    expect(
      compare(
        '<Button children={w}/>',
        '<Button><Other>{#snippet children()}hi{/snippet}</Other></Button>'
      ).violations
    ).not.toEqual([]);
  });

  it('accepts only a captured matching default, counting a bare attribute once', () => {
    const argTypes = { mode: { name: 'mode', table: { defaultValue: { summary: '"default"' } } } };
    expect(compare('<Chart mode="default"/>', '<Chart/>', argTypes)).toEqual({
      accepted: ['default-omitted'],
      violations: [],
    });
    expect(compare('<Chart mode="wide"/>', '<Chart/>', argTypes).violations).not.toEqual([]);
    expect(compare('<Chart mode="default"/>', '<Chart/>').violations).not.toEqual([]);
    expect(
      compare('<Chart disabled/>', '<Chart/>', {
        disabled: { name: 'disabled', table: { defaultValue: { summary: 'true' } } },
      })
    ).toEqual({ accepted: ['default-omitted'], violations: [] });
    expect(
      compare('<Chart disabled=true/>', '<Chart/>', {
        disabled: { name: 'disabled', table: { defaultValue: { summary: 'true' } } },
      }).violations
    ).not.toEqual([]);
    expect(compare('<Chart mode={defaultMode}/>', '<Chart/>', argTypes).violations).not.toEqual([]);
  });

  it('accepts only function events with a baseline self-reference', () => {
    const argTypes: StrictArgTypes = {
      onclick: { name: 'onclick', type: { name: 'function' }, table: { category: 'events' } },
    };
    expect(compare('<Button onclick={onclick}/>', '<Button/>', argTypes)).toEqual({
      accepted: ['event-omitted'],
      violations: [],
    });
    expect(compare('<Button onclick={handler}/>', '<Button/>', argTypes).violations).not.toEqual(
      []
    );
    expect(
      compare('<Button onclick={onclick}/>', '<Button/>', {
        onclick: { ...argTypes.onclick, table: { category: 'props' } },
      }).violations
    ).not.toEqual([]);
    expect(
      compare('<Button onclick={onclick}/>', '<Button/>', {
        onclick: { ...argTypes.onclick, type: { name: 'string' } },
      }).violations
    ).not.toEqual([]);
  });

  it('counts preserved bindings with declarations and keeps unrelated argument checks', () => {
    const baseline = '<Upload bind:files files={[]} title="hello"/>';
    const candidate = '<script>let files = [];</script><Upload bind:files/>';
    const result = compare(baseline, candidate);
    expect(result.accepted).toEqual(['binding-represented']);
    expect(result.violations.map((v) => v.arg)).toEqual(['title']);
    for (const rejected of [
      '<Upload bind:files/>',
      '<script>let files = [];</script><Upload/>',
      '<script>let other = [];</script><Upload bind:files={other}/>',
      '<script>let files;</script><Upload bind:files/>',
    ]) {
      expect(compare(baseline, rejected).violations.map((v) => v.arg)).toContain('files');
    }
    expect(compare('<Upload files={[]}/>', candidate).violations.map((v) => v.arg)).toContain(
      'files'
    );
  });

  it('keeps root changes and union changes outside accepted capture rules', () => {
    expect(compare('<It/>', '<Button/>').violations.map((v) => v.kind)).toContain('changed-root');
  });
});

it('omits only native mock self-references with verified source evidence', async () => {
  const { sourceDigest } = await import('./capture/story-source.ts');
  const text = `<script module>
    import { fn as mock } from 'storybook/test';
    import { defineMeta } from '@storybook/svelte-vite';
    const { Story } = defineMeta({ args: { onclick: mock().mockName('click') } });
  </script><Story name="Default"><button {...args}>Click</button></Story>`;
  const run = (
    source = text,
    baseline = '<button onclick={onclick}>Click</button>',
    candidate = '<button>Click</button>',
    digest = sourceDigest(source),
    sha = 'head'
  ) =>
    compareSvelteCaptureSnippet({
      baseline,
      candidate,
      argTypes: {},
      storyId: 'actions--default',
      sha: 'head',
      source: { source, digest, sha, importPath: './Actions.stories.svelte' },
    });
  expect(run()).toEqual({ accepted: ['native-mock-omitted'], violations: [] });
  expect(run(text.replace("mock().mockName('click')", 'mock()'))).toEqual({
    accepted: ['native-mock-omitted'],
    violations: [],
  });
  for (const result of [
    run(text, '<button onclick={other}>Click</button>'),
    run(text.replace("mock().mockName('click')", '() => {}')),
    run(text.replace("mock().mockName('click')", '42')),
    run(text.replace('storybook/test', 'other')),
    run(text, undefined, '<button>Changed</button>'),
    run(text, undefined, undefined, '0'.repeat(64)),
    run(text, undefined, undefined, undefined, 'other'),
    run(text.replace('<Story name="Default">', '<Story name="Default" args={{ onclick: 42 }}>')),
    run(text, '<Button onclick={onclick}/>', '<Button/>'),
    compare('<button onclick={onclick}>Click</button>', '<button>Click</button>'),
  ]) {
    expect(result.violations).not.toEqual([]);
    expect(result.accepted).not.toContain('native-mock-omitted');
  }
});
