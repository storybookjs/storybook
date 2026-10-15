import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillTransport } from './skill-refs.ts';
import { getSkillRef } from './skill-refs.ts';

export type ServerInstructionsInputs = {
  transport: SkillTransport;
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

/**
 * The MCP counterpart of the `## Storybook` section that `create storybook` writes in `AGENTS.md`
 * and of the plugin's skill stubs: which tool to call for which task, and how to end after a
 * review. The workflow itself is the ui-workflow skill, served by the story-instructions tool, so
 * both paths follow one text. MCP clients truncate server instructions (Claude Code cuts them at
 * 2,048 chars), so anything more belongs in that tool's result.
 */
export function buildServerInstructions({
  transport,
  devEnabled,
  testSupported,
  docsEnabled,
}: ServerInstructionsInputs): string {
  const ref = getToolName({ transport });
  const skillRef = getSkillRef(transport);

  const tasks = [
    devEnabled &&
      `- **${skillRef('ui-workflow')}**: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks;${testSupported ? ' you run or fix story tests;' : ''} or the user asks to see components or stories. It returns the mandatory, ordered workflow, with the tools each step calls: it ${docsEnabled ? 'looks up the components to reuse, ' : ''}updates your stories, ${testSupported ? 'runs the tests, ' : ''}and publishes a review of the results. Read it in its entirety.`,
    !devEnabled &&
      testSupported &&
      `- **${ref('test.run')}**: you run or fix story tests. It is the only way to run them, never a \`package.json\` test script; finish with one run without \`stories\`, and never finish with failing tests.`,
    docsEnabled &&
      `- **${ref('docs.list')}**, then **${ref('docs.show')}** with an id from its result: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. Answer from these tools, not from source or type definitions, and use only the props they document.`,
  ].filter(Boolean);

  if (tasks.length === 0) {
    return '';
  }

  const review = devEnabled
    ? `\n\nWhen you publish a review with **${ref('review.create')}**, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.`
    : '';

  return `## Storybook

For each of these tasks, call its Storybook tool first, before you edit any file, and follow its result:

${tasks.join('\n')}${review}`;
}
