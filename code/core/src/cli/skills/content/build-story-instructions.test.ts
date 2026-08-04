import { describe, expect, it } from 'vitest';

import { buildStoryInstructions } from './build-story-instructions.ts';

const baseInputs = {
  framework: '@storybook/react-vite',
  changeDetectionEnabled: true,
  reviewEnabled: true,
  testToolsetAvailable: true,
  a11yEnabled: false,
  docsAvailable: false,
} as const;

describe('buildStoryInstructions consumer refs', () => {
  it('MCP consumer names MCP tools', () => {
    const text = buildStoryInstructions({ ...baseInputs, consumer: 'mcp' });
    expect(text).toContain('get-changed-stories');
    expect(text).toContain('run-story-tests');
    expect(text).not.toContain('npx storybook tools');
  });

  it('CLI consumer names tools CLI commands', () => {
    const text = buildStoryInstructions({ ...baseInputs, consumer: 'cli' });
    expect(text).toContain('npx storybook tools stories changed');
    expect(text).toContain('npx storybook tools test run');
    expect(text).not.toContain('get-changed-stories');
  });

  it('maps framework to renderer, falling back to the framework name', () => {
    expect(buildStoryInstructions({ ...baseInputs, consumer: 'mcp' })).toContain(
      '@storybook/react'
    );
    expect(
      buildStoryInstructions({ ...baseInputs, consumer: 'mcp', framework: '@storybook/who-knows' })
    ).toContain('@storybook/who-knows');
  });
});

describe('buildStoryInstructions placeholder resolution', () => {
  it('replaces framework and renderer placeholders with no leftovers', () => {
    const instructions = buildStoryInstructions({ ...baseInputs, consumer: 'mcp' });

    expect(instructions).toContain('@storybook/react-vite');
    expect(instructions).toContain('@storybook/react');
    expect(instructions).toContain('preview-stories');
    expect(instructions).toContain('get-changed-stories');

    expect(instructions).not.toContain('{{FRAMEWORK}}');
    expect(instructions).not.toContain('{{RENDERER}}');
    expect(instructions).not.toContain('{{PREVIEW_STORIES}}');
    expect(instructions).not.toContain('{{STORY_LINKING_WORKFLOW}}');
    expect(instructions).not.toContain('{{CHANGED_STORY_FALLBACK_LINK_GUIDANCE}}');
    expect(instructions).not.toContain('{{FINAL_LINKS_GUIDANCE}}');
    expect(instructions).not.toContain('{{DOCS_WORKFLOW_GUIDANCE}}');
  });

  // The story-instructions output is the one channel every agent reads before
  // writing UI and is never truncated by MCP clients, so it must carry the
  // docs-workflow trigger whenever the documentation tools are registered.
  it('includes the docs workflow guidance when docs are available', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      docsAvailable: true,
    });

    expect(instructions).toContain('## Using library components');
    expect(instructions).toContain('**list-all-documentation**');
    expect(instructions).toContain('**get-documentation**');
    expect(instructions).toContain('`storybookId`');
    expect(instructions).not.toContain('{{DOCS_WORKFLOW_GUIDANCE}}');
  });

  it('omits the docs workflow guidance when docs are unavailable', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      docsAvailable: false,
    });

    expect(instructions).not.toContain('## Using library components');
    expect(instructions).not.toContain('{{DOCS_WORKFLOW_GUIDANCE}}');
  });
});

describe('buildStoryInstructions review-aware link guidance', () => {
  // Regression: the story-instructions output must agree with the server
  // instructions about how to present links. It previously told the agent to
  // list the review page AND the preview URLs together, contradicting the
  // "show one set of links — never both" server rule.
  it('tells the agent to show only the review section when review is enabled', () => {
    const instructions = buildStoryInstructions({ ...baseInputs, consumer: 'mcp' });

    expect(instructions).toContain('show one set of links — never both');
    expect(instructions).toContain('## 👀 Review your changes');
    expect(instructions).toContain('Never also list the individual story or preview URLs');
    // The old contradictory instruction must be gone.
    expect(instructions).not.toContain('present links in this order');

    // The story-linking workflow must route discovery into the review, not
    // the preview list, and forbid hand-constructed story IDs — matching
    // the server instructions that `storybook ai --help` also embeds.
    expect(instructions).toContain('Story IDs must come from that call');
    expect(instructions).toContain('never construct them from file names');
    expect(instructions).toContain('Feed the discovered IDs into **display-review**');
    expect(instructions).not.toContain('first, then use `preview-stories`');
  });

  it('tells the agent to include preview URLs when review is disabled', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      reviewEnabled: false,
    });

    expect(instructions).toContain('include every returned preview URL');
    expect(instructions).not.toContain('## 👀 Review your changes');
    expect(instructions).not.toContain('present links in this order');
  });

  it('should not mention changed stories workflow when change detection is disabled', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      changeDetectionEnabled: false,
      reviewEnabled: false,
    });

    expect(instructions).toContain('preview-stories');
    expect(instructions).not.toContain('get-changed-stories');
  });
});

describe('buildStoryInstructions framework handling', () => {
  it('should handle Vue framework', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      framework: '@storybook/vue3-vite',
    });

    expect(instructions).toContain('@storybook/vue3-vite');
    expect(instructions).toContain('@storybook/vue3');
  });
});

describe('buildStoryInstructions test toolset and a11y', () => {
  it('should include testing instructions and a11y guidance when both are enabled', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      testToolsetAvailable: true,
      a11yEnabled: true,
    });

    expect(instructions).toContain('Story Testing Requirements');
    expect(instructions).toContain('run-story-tests');
    expect(instructions).toContain('(see a11y guidelines below)');
    expect(instructions).toContain('### Accessibility Violations');
  });

  it('should exclude testing and a11y instructions when the test toolset is unavailable', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      testToolsetAvailable: false,
      a11yEnabled: true,
    });

    expect(instructions).not.toContain('Story Testing Requirements');
    expect(instructions).not.toContain('### Accessibility Violations');
  });

  it('should include testing but exclude a11y guidance when a11y is disabled', () => {
    const instructions = buildStoryInstructions({
      ...baseInputs,
      consumer: 'mcp',
      testToolsetAvailable: true,
      a11yEnabled: false,
    });

    expect(instructions).toContain('Story Testing Requirements');
    expect(instructions).not.toContain('(see a11y guidelines below)');
    expect(instructions).not.toContain('### Accessibility Violations');
  });
});
