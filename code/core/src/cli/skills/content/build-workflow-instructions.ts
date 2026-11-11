import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillId } from './skills.ts';
import type { SkillTextTransport } from './skill-vocabulary.ts';

export type ServerInstructionsInputs = {
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

type Step = { skill: SkillId; does: string; also?: string };

function workflowSteps({ devEnabled, testSupported, docsEnabled }: ServerInstructionsInputs) {
  const steps: (Step | false)[] = [
    docsEnabled && {
      skill: 'component-docs',
      does: 'look up the components to reuse, with their props and usage examples, before you edit any file',
      also: "the user asks about a component's props, API, or usage",
    },
    // Without the `dev` toolset the server is for lookups and test runs, not for the story workflow.
    devEnabled && {
      skill: 'write-stories',
      does: 'every component you create or change gets stories',
    },
    testSupported && {
      skill: 'test-stories',
      // An agent that skips the skill runs the test script of the project, so this rule is here too.
      does: 'run the story tests after every change, the way this skill says, never with a `package.json` test script, and fix what fails',
      also: 'the user asks to run or fix story tests',
    },
    devEnabled && {
      skill: 'ui-review',
      does: 'publish a review that shows the user what changed, as your last step',
      also: 'the user asks to see components or stories',
    },
  ];
  return steps.filter((step) => step !== false);
}

// The workflow that ties the skills together: one step per skill, in the order an agent takes
// them. A project edits it to change the workflow, for example to drop the review.
function buildWorkflow(inputs: ServerInstructionsInputs, transport: SkillTextTransport): string {
  const cli = transport === 'cli';
  const steps = workflowSteps(inputs).map(
    ({ skill, does, also }, index) =>
      `${index + 1}. \`${cli ? skill : `npx storybook skills ${skill} --mcp`}\`: ${does}.${also ? ` Also when ${also}.` : ''}`
  );
  const several = steps.length > 1;
  const inOwnCommand =
    'in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`';
  // An agent opens the skills it is told to open at the start of its task. One it has to open
  // halfway is the one it skips, so all of them come first, in a sentence of their own.
  const open = several
    ? cli
      ? 'First invoke the skills of all the steps, before you edit any file. Then follow each skill at its step.'
      : `First run the skills of all the steps, before you edit any file: each ${inOwnCommand}. Then follow each skill at its step.`
    : cli
      ? 'Invoke it before you edit any file, and follow it.'
      : `Run it before you edit any file, ${inOwnCommand}, and follow it.`;
  const follow = several
    ? 'follow these steps in order. Each step has a Storybook skill.'
    : 'follow this step. It has a Storybook skill.';
  return `## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), ${follow} ${open}

${steps.join('\n')}`;
}

// The `## Storybook` section that `create storybook` and `storybook upgrade` write in `AGENTS.md`.
export function buildAgentInstructions(): string {
  return buildWorkflow({ devEnabled: true, testSupported: true, docsEnabled: true }, 'cli');
}

/**
 * The MCP counterpart of the `AGENTS.md` section: the same steps in the same words, but each one
 * runs its skill with `--mcp`, which names the tools of this server instead of CLI commands, so
 * both paths follow one text. MCP clients truncate server instructions (Claude Code cuts them at
 * 2,048 chars), so anything more belongs in the skills.
 */
export function buildServerInstructions(inputs: ServerInstructionsInputs): string {
  if (!inputs.devEnabled && !inputs.testSupported && !inputs.docsEnabled) {
    return '';
  }
  // Persistent context, like the plugin's SKILL.md: by the final answer, the skill and the
  // review-create result are many calls back, and agents left the review lines out.
  const review = inputs.devEnabled
    ? `\n\nWhen you publish a review with \`${getToolName({ transport: 'mcp' })('review.create')}\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.`
    : '';
  // The tools are at hand over MCP, so an agent can do a step without its skill. It did for a
  // request that is one step, where no file edit comes first.
  const skillFirst =
    workflowSteps(inputs).length > 1
      ? '\n\nRun the skill of a step before you call a tool of that step, also when the request is only that step.'
      : '\n\nRun the skill before you call a tool of this step, also when the request is only this step.';
  return `${buildWorkflow(inputs, 'mcp')}${skillFirst}${review}`;
}
