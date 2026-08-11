import { getToolName } from '../../../shared/open-service/toolset-names.ts';

import { getFinalLinksGuidance } from './build-server-instructions.ts';
import { frameworkToRendererMap } from './framework-renderer.ts';
import a11yInstructionsTemplate from './instructions/a11y-instructions.md';
import storyTestingInstructionsTemplate from './instructions/story-testing-instructions.md';
import storyInstructionsTemplate from './instructions/storybook-story-instructions.md';
import type { SkillTransport } from './skill-refs.ts';

export type StoryInstructionsInputs = {
  transport: SkillTransport;
  framework: string;
  /** Renderer package name; defaults to `framework` when unmapped (today's behavior). */
  renderer?: string;
  changeDetectionEnabled: boolean;
  reviewEnabled: boolean;
  testSupported: boolean;
  a11yEnabled: boolean;
  docsEnabled: boolean;
};

export function buildStoryInstructions({
  transport,
  framework,
  renderer,
  changeDetectionEnabled,
  reviewEnabled,
  testSupported,
  a11yEnabled,
  docsEnabled,
}: StoryInstructionsInputs): string {
  const ref = getToolName({ transport });
  const resolvedRenderer = renderer ?? frameworkToRendererMap[framework] ?? framework;

  // Mirrors the review-aware rewrite in build-server-instructions.ts:
  // discovery feeds the review, not the preview list. Plugin-path agents do
  // see those server instructions (`storybook ai --help` embeds them as its
  // "# Storybook workflow instructions" section), but this tool is billed as
  // the source of truth for story work and this line still routed discovery
  // into previews — a contradiction agents resolved by constructing story
  // IDs from file names and publishing reviews with zero discovery calls.
  // The two channels must state the same workflow.
  const storyLinkingWorkflow = changeDetectionEnabled
    ? reviewEnabled
      ? `After changing any component or story, call \`${ref('stories.changed')}\` to discover the new, modified, and related stories affected by your change. Story IDs must come from that call (or a fallback discovery tool such as ${ref('stories.findByComponent')} for shared-infrastructure changes) — never construct them from file names, export names, or memory. Feed the discovered IDs into **${ref('review.create')}** when the change is visually observable; use \`${ref('stories.preview')}\` only while iterating on a specific story.`
      : `After changing UI, call \`${ref('stories.changed')}\` first, then use \`${ref('stories.preview')}\` with selected \`storyId\` values from those results.`
    : `After changing UI, call \`${ref('stories.preview')}\` and share the most relevant links for the changes.`;
  const changedStoryFallbackLinkGuidance = changeDetectionEnabled
    ? `When sharing preview/story links (not when ending with a review section): if you did not pass every changed story into \`${ref('stories.preview')}\`, include this Storybook fallback link so the user can view the complete changed list: \`/?statuses=affected;modified;new\`.`
    : `When sharing preview/story links (not when ending with a review section) and you passed only a subset into \`${ref('stories.preview')}\`, mention that additional relevant stories may exist in Storybook.`;

  /**
   * Injected into the story instructions when the documentation toolset is
   * available. This tool output is the one channel every agent reads before
   * writing UI (on both the MCP and the CLI/plugin path) and is never
   * truncated, so it must carry the docs-workflow trigger — the server
   * instructions only have room for a terse pointer, and agents otherwise
   * default to reading library sources out of node_modules.
   */
  const docsWorkflowGuidance = `

## Using library components

This Storybook exposes component documentation tools. Before creating or changing any UI, call **${ref('docs.list')}** once to see what the design system already provides — build on existing components instead of hand-rolling duplicates — then call **${ref('docs.show')}** with the \`id\` of each component you build on or get asked about, for its real props and usage examples. When multiple Storybook sources are configured, pass the \`storybookId\` from **${ref('docs.list')}** on follow-up calls. Do this instead of reading the library's source or type definitions out of \`node_modules\` — stories show intended usage, raw types don't — and answer props/usage questions from these tools too. Never assume or invent props.`;

  let uiInstructions = storyInstructionsTemplate
    .replace('{{FRAMEWORK}}', framework)
    .replace('{{RENDERER}}', resolvedRenderer)
    .replace('\n{{DOCS_WORKFLOW_GUIDANCE}}', docsEnabled ? docsWorkflowGuidance : '')
    .replace('{{STORY_LINKING_WORKFLOW}}', storyLinkingWorkflow)
    .replace('{{FINAL_LINKS_GUIDANCE}}', getFinalLinksGuidance(transport, reviewEnabled))
    .replace('{{PREVIEW_STORIES}}', ref('stories.preview'))
    .replace('{{CHANGED_STORY_FALLBACK_LINK_GUIDANCE}}', changedStoryFallbackLinkGuidance);

  if (testSupported) {
    const a11yFixSuffix = a11yEnabled ? ' (see a11y guidelines below)' : '';

    const storyTestingInstructions = storyTestingInstructionsTemplate
      .replaceAll('{{RUN_STORY_TESTS_TOOL_NAME}}', ref('test.run'))
      .replace('{{A11Y_FIX_SUFFIX}}', a11yFixSuffix);

    uiInstructions += `\n\n${storyTestingInstructions}`;
    if (a11yEnabled) {
      uiInstructions += `\n${a11yInstructionsTemplate}`;
    }
  }

  return uiInstructions;
}
