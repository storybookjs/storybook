import { describe, expect, it } from 'vitest';

import { buildJudgeRequest } from './context.ts';

import type { NodeRecord } from '../ds-coverage/types.ts';

const DOCS = [
  { path: 'src/docs/BrandGuidelines.mdx', text: '# Brand\nUse colour tokens.\n' },
  { path: 'src/components/Button/Button.mdx', text: '# Button\n' },
];

const NODE: NodeRecord = {
  path: 'App/Button[0]',
  file: 'src/App.tsx',
  line: 3,
  tag: 'Button',
  category: 'ds',
  module: '@droppy/react',
  name: 'Button',
  weight: 1,
  props: ['variant'],
};

function build(overrides: Partial<Parameters<typeof buildJudgeRequest>[0]> = {}) {
  return buildJudgeRequest({
    docs: DOCS,
    baselineNodes: [],
    treatmentNodes: [NODE],
    patch: {
      text: 'diff --git a/src/App.tsx b/src/App.tsx\n',
      files: ['src/App.tsx'],
      beforePaths: ['src/App.tsx'],
      truncated: false,
      droppedFiles: 0,
    },
    fixtureRef: 'yannbf/mealdrop@refs/tags/x',
    ...overrides,
  });
}

describe('buildJudgeRequest', () => {
  it('targets claude-opus-5 at xhigh effort with room for a large reasoning budget', () => {
    const request = build();
    expect(request.model).toBe('claude-opus-5');
    expect(request.max_tokens).toBe(64_000);
    expect(request.output_config.effort).toBe('xhigh');
  });

  // Caching is a prefix match: anything volatile placed before the breakpoint
  // invalidates the ~95k-token corpus on every single request.
  it('puts the stable prompt and docs in system, volatile content in messages', () => {
    const request = build();
    const system = request.system as Array<{ text: string }>;
    expect(system).toHaveLength(2);
    expect(system[0]!.text).toContain('You are auditing');
    expect(system[1]!.text).toContain('Use colour tokens.');
    expect(JSON.stringify(request.system)).not.toContain('yannbf/mealdrop');
  });

  it('marks the last system block as the cache breakpoint with a 1h ttl', () => {
    const system = build().system as Array<{ cache_control?: unknown }>;
    expect(system[0]!.cache_control).toBeUndefined();
    expect(system[1]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  it('appends the facet catalogue to the prompt block', () => {
    const request = build();
    const promptBlock = request.system[0]!.text;
    expect(promptBlock).toContain('## Documentation facet catalogue');
    expect(promptBlock).toContain('- `mdx.do-dont` —');
    expect(promptBlock).toContain('- `general.general-when-to-use` —');
    // The cacheable docs block stays last and untouched.
    expect(request.system[1]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  // Two runs of two different arms share the corpus byte for byte, which is the
  // only reason the cache pays for itself.
  it('produces a byte-identical system block for different runs', () => {
    expect(JSON.stringify(build().system)).toBe(
      JSON.stringify(build({ fixtureRef: 'other/repo@sha', treatmentNodes: [] }).system)
    );
  });

  it('carries both node lists and the diff in the user turn', () => {
    const text = String((build().messages[0]!.content as Array<{ text: string }>)[0]!.text);
    expect(text).toContain('BEFORE NODES (the changed files as they were before the agent worked)');
    expect(text).toContain('AFTER NODES');
    expect(text).toContain('diff --git a/src/App.tsx');
    expect(text).toContain('App/Button[0]');
  });

  // judgeRun (index.ts) narrows baselineNodes to patch.beforePaths before
  // calling here, on the reasoning that a file the diff never touches has no
  // move to show. That narrowing only does its job if this function renders
  // exactly the nodes it is handed — no wider, whole-tree fallback sneaking
  // back in beside it.
  it('renders BEFORE NODES from exactly the baseline nodes it is given', () => {
    const inScope: NodeRecord = { ...NODE, path: 'App/Button[1]', file: 'src/App.tsx' };
    const excludedByFilter: NodeRecord = {
      ...NODE,
      path: 'Other/Button[0]',
      file: 'src/Other.tsx',
    };
    const text = String(
      (
        build({ baselineNodes: [inScope] }).messages[0]!.content as Array<{
          text: string;
        }>
      )[0]!.text
    );
    expect(text).toContain('App/Button[1]');
    expect(text).not.toContain(excludedByFilter.path);
  });

  // The prompt tells the judge to omit what it cannot see; it has to be told.
  it('announces truncation to the judge', () => {
    const text = String(
      (
        build({
          patch: {
            text: 'diff --git a/src/A.tsx b/src/A.tsx\n',
            files: ['src/A.tsx'],
            beforePaths: ['src/A.tsx'],
            truncated: true,
            droppedFiles: 4,
          },
        }).messages[0]!.content as Array<{ text: string }>
      )[0]!.text
    );
    expect(text).toContain('TRUNCATED');
    expect(text).toContain('4');
  });
});
