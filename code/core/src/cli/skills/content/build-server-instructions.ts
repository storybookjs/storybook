import { getToolName } from '../../../shared/open-service/toolset-names.ts';

export type ServerInstructionsInputs = {
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

/**
 * The MCP counterpart of the `## Storybook` section that `create storybook` writes in `AGENTS.md`:
 * the same tasks in the same words, but each one runs its skill with `--mcp`, which names the
 * tools of this server instead of CLI commands. Both paths so follow one text. MCP clients truncate
 * server instructions (Claude Code cuts them at 2,048 chars), so anything more belongs in the
 * skills.
 */
export function buildServerInstructions({
  devEnabled,
  testSupported,
  docsEnabled,
}: ServerInstructionsInputs): string {
  const ref = getToolName({ transport: 'mcp' });

  const steps = [
    docsEnabled && 'looks up the components to reuse',
    'updates your stories',
    testSupported && 'runs the tests',
    'publishes a review of the results',
  ].filter(Boolean);
  const workflow = `${steps.slice(0, -1).join(', ')}${steps.length > 2 ? ',' : ''} and ${steps.at(-1)}`;

  const tasks = [
    devEnabled &&
      `- \`npx storybook skills ui-workflow --mcp\`: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks;${testSupported ? ' you run or fix story tests;' : ''} or the user asks to see components or stories. It ${workflow}.`,
    !devEnabled &&
      testSupported &&
      `- **${ref('test.run')}**: you run or fix story tests. It is the only way to run them, never a \`package.json\` test script; finish with one run without \`stories\`, and never finish with failing tests.`,
    docsEnabled &&
      `- \`npx storybook skills component-docs --mcp\`: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. It lists the project's components with their props and usage examples.`,
  ].filter(Boolean);

  if (tasks.length === 0) {
    return '';
  }

  const runsSkills = devEnabled || docsEnabled;
  const callsTool = !devEnabled && testSupported;
  const first = [runsSkills && 'run its Storybook skill', callsTool && 'call its Storybook tool']
    .filter(Boolean)
    .join(' or ');
  const skillRule = runsSkills
    ? ' Run a skill in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`.'
    : '';
  const intro = `For ${tasks.length > 1 ? 'each of these tasks' : 'this task'}, ${first} first, before you edit any file, and follow it.${skillRule}`;
  const review = devEnabled
    ? `\n\nWhen you publish a review with **${ref('review.create')}**, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.`
    : '';

  return `## Storybook

${intro}

${tasks.join('\n')}${review}`;
}
