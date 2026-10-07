import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import devInstructions from './instructions/dev-instructions.md';
import docsInstructions from './instructions/docs-instructions.md';
import testInstructions from './instructions/test-instructions.md';
import type { SkillTransport } from './skill-refs.ts';
import { getSkillRef } from './skill-refs.ts';

export type ServerInstructionsInputs = {
  transport: SkillTransport;
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
  changeDetectionEnabled?: boolean;
  /**
   * `stories-find-by-component` is registered whenever the dev-server exposes the module
   * graph — even if `features.changeDetection` is off and `stories-changed` is unavailable.
   * When true and `changeDetectionEnabled` is false, the workflow falls back to manual lookup
   * via `stories-find-by-component` instead of the status-store-driven `stories-changed`.
   */
  moduleGraphSupported?: boolean;
  reviewEnabled?: boolean;
};

/**
 * The full rule for how the agent should present links in its final
 * user-facing response, delivered through the
 * `get-storybook-story-instructions` output. The server instructions only
 * carry a terse pointer to the same rule: MCP clients truncate server
 * instructions (Claude Code cuts them at 2,048 chars), so anything beyond
 * the workflow trigger must live in tool descriptions and tool results.
 *
 * Keyed on whether `review-create` is available in this Storybook setup.
 * When available, the guidance covers both paths: ending with a review section
 * after publishing, or falling back to preview URLs when no review was published
 * (e.g. non-visual refactors).
 */
export function getFinalLinksGuidance(
  transport: SkillTransport,
  reviewToolAvailable: boolean
): string {
  const ref = getToolName({ transport });
  return reviewToolAvailable
    ? `In your final user-facing response, show one set of links — never both. If you published a review with **${ref('review.create')}**, finish your reply with a dedicated review section as the very last thing in the output: its own top-level heading on a line by itself (for example \`## 👀 Review your changes\`), then a one-line explanation that the review shows the handful of stories most relevant to this change and that, because it is AI-curated, results may be inaccurate or incomplete, then on the next line the review page as a markdown link prefixed with a 👉 so it is easy to spot, using the returned \`reviewUrl\` (for example \`👉 [Open the Storybook review page](<reviewUrl>)\`). Nothing should come after this section. Never also list the individual story or preview URLs. Avoid internal jargon like "collection" or "trigger" in anything the user reads — those are terms from this tooling, not words that mean anything to them; use plain language unless the user used the term first. A visually observable change is not finished until its review is published — never substitute preview URLs for the review. If **${ref('review.create')}** keeps failing, end with the **${ref('stories.preview')}** URLs instead and say the review could not be published. Only when there is no review because the change has no visually observable impact, say so plainly; include preview URLs only if the user asked to see specific stories.`
    : 'In your final user-facing response, include every returned preview URL so the user can verify the visual result, ordered consistently (changed-stories fallback first if relevant, then the specific preview URLs).';
}

export function buildServerInstructions({
  transport,
  ...options
}: ServerInstructionsInputs): string {
  const ref = getToolName({ transport });
  const skillRef = getSkillRef(transport);

  // The docs-question rule lives in the very first line: agents (observed on
  // Claude Code) default to grepping component source for props/usage
  // questions and never reach a rule that only appears further down in the
  // Documentation Workflow section.
  const sections = [
    options.docsEnabled
      ? 'Follow these workflows when working with UI and/or Storybook. Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions.'
      : 'Follow these workflows when working with UI and/or Storybook.',
  ];
  const reviewEnabled = options.reviewEnabled ?? false;

  if (options.devEnabled) {
    const afterEditing =
      'After editing anything that changes how the UI looks — components, stories, styles, themes, tokens —';
    const discoverStoriesStep = options.changeDetectionEnabled
      ? `${afterEditing} call **${ref('stories.changed')}** to discover the affected stories.`
      : options.moduleGraphSupported
        ? `${afterEditing} call **${ref('stories.findByComponent')}** with the files you touched.`
        : `${afterEditing} identify the affected stories.`;
    // With review on, discovery feeds review-create: a stories-preview step here reads as an
    // alternative ending and agents take it.
    const previewStoriesStep = reviewEnabled
      ? discoverStoriesStep
      : `${discoverStoriesStep} Then call **${ref('stories.preview')}** for the most relevant ones, no exceptions; a shared file has no stories of its own, so preview its consumers' stories.`;
    // Terse pointer only: the full link-presentation rule reaches the agent
    // through the get-storybook-story-instructions output (getFinalLinksGuidance)
    // and the review-create and stories-preview tool results, which are
    // never truncated.
    const finalLinksStep = reviewEnabled
      ? `End your final response with the review section from **${ref('review.create')}**'s result — never substitute preview URLs. **${ref('stories.preview')}** is only for mid-loop iteration or a requested direct link. If nothing visually changed, say so.`
      : 'Include every returned preview URL in your final response.';
    sections.push(
      devInstructions
        .replace(
          '{{STORY_INSTRUCTIONS_STEP}}',
          `Before creating or editing components or stories, call **${skillRef('write-story')}**; its output is the source of truth for imports, story patterns, and testing conventions.`
        )
        .replace('{{PREVIEW_STORIES_STEP}}', previewStoriesStep)
        .replace('{{FINAL_LINKS_STEP}}', finalLinksStep)
        .replace(
          '{{DISPLAY_REVIEW_STEP}}',
          reviewEnabled
            ? `\n- After a visually observable UI change, or when the user asks to see or browse stories/components, call **${ref('review.create')}** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.`
            : ''
        )
        .replace(
          '{{FIND_BY_COMPONENT_STEP}}',
          options.moduleGraphSupported
            ? ` **${ref('stories.findByComponent')}** maps any input to stories; its description covers the workflow. No matches means no stories exist yet — say so.`
            : ''
        )
        .trim()
    );
  }

  if (options.testSupported) {
    sections.push(
      testInstructions
        .replaceAll('{{RUN_STORY_TESTS}}', ref('test.run'))
        // With the review workflow, this line would not fit under the 2,048 chars MCP clients keep.
        .replace(
          '{{FOCUSED_RUNS_STEP}}',
          reviewEnabled
            ? ''
            : '\n- Use focused runs while iterating, then a broad pass before handoff when scope is unclear or wide.'
        )
        .trim()
    );
  }

  if (options.docsEnabled) {
    sections.push(
      docsInstructions
        .replaceAll('{{DOCS_LIST}}', ref('docs.list'))
        .replaceAll('{{DOCS_SHOW}}', ref('docs.show'))
        .trim()
    );
  }

  if (sections.length === 1) {
    return '';
  }

  return sections.join('\n\n');
}
