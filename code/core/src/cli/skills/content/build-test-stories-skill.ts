import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type TestStoriesSkillInputs = {
  // `mcp` for `skills test-stories --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // `@storybook/addon-vitest` is enabled.
  testSupported: boolean;
  // `main.ts` turns the `test` toolset of the MCP server off. Never for the CLI.
  toolsetOff?: boolean;
  a11yEnabled: boolean;
};

// The `AGENTS.md` section names the command itself, so this skill is for an agent that opens it by
// name. It names the same forms of the command.
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
    ? '\n\nThe run lists accessibility violations under `## Accessibility Violations`. Fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design. Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    : '';
  const command = v.cli
    ? `\`\`\`sh
${v.ref('test.run')} --changed                # the stories your uncommitted changes reach
${v.ref('test.run')} src/Button.stories.tsx   # the stories in these story files
${v.ref('test.run')}                          # every story
\`\`\``
    : `- ${v.name('test.run')} with \`changed: true\`: the stories your uncommitted changes reach
- ${v.name('test.run')} with \`files: ["src/Button.stories.tsx"]\`: the stories in these story files
- ${v.name('test.run')} with neither: every story`;
  return `# Test the stories

${v.notes}${toolsetOff}

${command}

${v.Run} it after every change, with ${v.cli ? '`--changed`' : '`changed: true`'}. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.${a11y}`;
}
