import { findStoriesSection, type FindStoriesInputs } from './find-stories.ts';
import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type TestStoriesSkillInputs = FindStoriesInputs & {
  // `mcp` for `skills test-stories --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // `@storybook/addon-vitest` is enabled.
  testSupported: boolean;
  // `main.ts` turns the `test` toolset of the MCP server off. Never for the CLI.
  toolsetOff?: boolean;
  a11yEnabled: boolean;
};

export function buildTestStoriesSkill(inputs: TestStoriesSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  if (!inputs.testSupported) {
    return `# Test the stories

This project cannot run story tests: it has no \`@storybook/addon-vitest\`. Skip this step.`;
  }
  // A client can turn the toolset on for itself with a request header, which this text cannot see.
  const toolsetOff = inputs.toolsetOff
    ? `\n\nThe \`main.ts\` of this project turns the \`test\` toolset of the Storybook MCP server off. When the server does not give you ${v.name('test.run')}, skip this step.`
    : '';
  const a11y = inputs.a11yEnabled
    ? '\n\nThe run lists accessibility violations under `## Accessibility Violations`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    : '';
  const command = v.cli
    ? `\`\`\`sh
${v.ref('test.run')} --stories '[{"storyId":"<id>"}]'   # ids from "Find the stories"; leave out --stories to run every story
\`\`\``
    : `- ${v.name('test.run')} with \`stories: [{ "storyId": "<id>" }]\`: ids from "Find the stories"; leave out \`stories\` to run every story`;
  return `# Test the stories

${v.notes}${toolsetOff}

${command}

${v.cli ? 'Run this' : `Call ${v.name('test.run')}`} after every change: focused runs with ${v.flag('stories')} while you iterate, then one full run without ${v.flag('stories')} before you finish. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.${a11y}

${findStoriesSection(v, inputs, { forReview: false })}`;
}
