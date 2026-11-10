import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillId } from './skills.ts';
import type { SkillTextTransport } from './skill-vocabulary.ts';

export type ServerInstructionsInputs = {
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

type Step = { skill: SkillId; when: string; does: string; also?: string };

function workflowSteps({ devEnabled, testSupported, docsEnabled }: ServerInstructionsInputs) {
  const steps: (Step | false)[] = [
    docsEnabled && {
      skill: 'component-docs',
      when: 'before you edit any file',
      does: 'look up the components to reuse, with their props and usage examples',
      also: "the user asks about a component's props, API, or usage",
    },
    // Without the `dev` toolset the server is for lookups and test runs, not for the story workflow.
    devEnabled && {
      skill: 'write-stories',
      when: 'before you write the code',
      does: 'every component you create or change gets stories',
    },
    testSupported && {
      skill: 'test-stories',
      when: 'after every change',
      // An agent that skips the skill runs the test script of the project, so this rule is here too.
      does: 'run the story tests the way this skill says, never with a `package.json` test script, and fix what fails',
      also: 'the user asks to run or fix story tests',
    },
    devEnabled && {
      skill: 'ui-review',
      when: 'as your last step',
      does: 'publish a review that shows the user what changed',
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
    ({ skill, when, does, also }, index) =>
      `${index + 1}. \`${cli ? skill : `npx storybook skills ${skill} --mcp`}\`, ${when}: ${does}.${also ? ` Also when ${also}.` : ''}`
  );
  // An agent opens every skill it is told to open at the start of its task. One it has to open
  // halfway is the one it skips, so all of them come first.
  const open = cli
    ? 'invoke the skills of all your steps before you edit any file, and follow each one when you reach its step.'
    : 'run the skills of all your steps before you edit any file, and follow each one when you reach its step. Run a skill in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`.';
  const follow =
    steps.length > 1
      ? `follow these steps in order. Each step has a Storybook skill: ${open}`
      : `follow this step. It has a Storybook skill: ${cli ? 'invoke' : 'run'} it before you edit any file, and follow it.${cli ? '' : ' Run it in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`.'}`;
  return `## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), ${follow}

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
  return `${buildWorkflow(inputs, 'mcp')}${review}`;
}
