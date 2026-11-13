import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type TestStoriesSkillInputs = {
  // `mcp` for `skills test-stories --mcp`: tools of the Storybook MCP server instead of commands.
  transport: SkillTextTransport;
  // `@storybook/addon-vitest` is enabled.
  testSupported: boolean;
  // `main.ts` turns the `test` toolset of the MCP server off. Never for the CLI.
  toolsetOff?: boolean;
};

// The `AGENTS.md` section names the command itself, so this skill is for an agent that opens it by
// name. It says what the section says, and no more: the output of a run says what to do next
// (fix and rerun, the accessibility rules, the run of every story before finishing).
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

${v.Run} it after every change${v.cli ? ', from the package where Storybook is installed' : ''}, with ${v.flag('changed')}${v.cli ? '' : ' set'}, and fix what fails. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests.`;
}
