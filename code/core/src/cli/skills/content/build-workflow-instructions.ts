import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillId } from './skills.ts';
import type { SkillTextTransport } from './skill-vocabulary.ts';

export type ServerInstructionsInputs = {
  testSupported: boolean;
  docsEnabled: boolean;
};

// A step opens a skill, names the test command itself (an agent runs the tests right from that
// line, without a skill in between), or tells the user about the review.
type Step = { skill: SkillId; does: string } | { tests: true } | { review: true };

function workflowSteps({ testSupported, docsEnabled }: ServerInstructionsInputs) {
  const steps: (Step | false)[] = [
    docsEnabled && {
      skill: 'component-docs',
      // When the user asks about a component is in the description of the skill, as for `/ui-review`.
      does: 'look up the components to reuse, with their props and usage examples, before you edit any file',
    },
    {
      skill: 'write-stories',
      // The reason to open the skill: how stories are written now, which training data lags behind.
      does: 'every component you create or change gets stories, written with the current best practices for this Storybook version and this project',
    },
    testSupported && { tests: true },
    { review: true },
  ];
  return steps.filter((step): step is Step => Boolean(step));
}

// The test step names the command that tests stories in this project, and nothing more: when to
// test and that failures get fixed is what the agent and its harness already do.
function testStep(number: number, transport: SkillTextTransport): string {
  const run = getToolName({ transport })('test.run');
  if (transport === 'mcp') {
    return `${number}. To test stories, call \`${run}\`: with neither for every story, with \`files\` for these story files, with \`changed: true\` for the stories your changes affect.`;
  }
  // `[files...]` as `test run --help` writes it.
  return `${number}. To test stories in the CLI run:
   \`\`\`sh
   ${run} [files...]   # every story, or these story files
   ${run} --changed    # the stories your changes affect
   \`\`\``;
}

// After a visible change the agent tells the user about the review instead of creating one: a
// review costs about a thousand tokens and a running dev server, also when nobody looks at it.
// When to open `ui-review` is in the description of that skill, as for any skill. This step is in
// the persistent section because by the final answer anything else is many calls back.
export const REVIEW_HINT_LINE =
  'Use the /ui-review skill to see the changed components in Storybook';
const reviewStep = (number: number) =>
  `${number}. ALWAYS inform the user about the \`/ui-review\` skill after a change the user can see: "${REVIEW_HINT_LINE}"`;

// The workflow that ties the skills together, in the order an agent takes the steps. A project
// edits it to change the workflow.
function buildWorkflow(inputs: ServerInstructionsInputs, transport: SkillTextTransport): string {
  const cli = transport === 'cli';
  const steps = workflowSteps(inputs);
  const lines = steps.map((step, index) => {
    const number = index + 1;
    if ('tests' in step) {
      return testStep(number, transport);
    }
    if ('review' in step) {
      return reviewStep(number);
    }
    return `${number}. \`${cli ? `/${step.skill}` : `npx storybook skills ${step.skill} --mcp`}\`: ${step.does}.`;
  });
  const skillSteps = steps.flatMap((step, index) => ('skill' in step ? [index + 1] : []));
  const inOwnCommand =
    'in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`';
  // An agent opens the skills it is told to open at the start of its task. One it has to open
  // halfway is the one it skips, so all of them come first, in a sentence of their own.
  // `write-stories` is always a step, `component-docs` only with a components manifest.
  const open =
    skillSteps.length > 1
      ? cli
        ? `First invoke the Storybook skills of steps ${skillSteps.join(' and ')}, before you edit any file. Then follow each skill at its step.`
        : `First run the Storybook skills of steps ${skillSteps.join(' and ')}, before you edit any file: each ${inOwnCommand}. Then follow each skill at its step.`
      : cli
        ? `First invoke the Storybook skill of step ${skillSteps[0]}, before you edit any file. Then follow it at its step.`
        : `First run the Storybook skill of step ${skillSteps[0]}, before you edit any file, ${inOwnCommand}. Then follow it at its step.`;
  return `## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. ${open}

${lines.join('\n')}`;
}

/**
 * The `## Storybook` section that `create storybook` and `storybook upgrade` write in `AGENTS.md`.
 * Without `@storybook/addon-vitest` the project cannot run story tests, so it gets no test step.
 */
export function buildAgentInstructions({ testSupported }: { testSupported: boolean }): string {
  return buildWorkflow({ testSupported, docsEnabled: true }, 'cli');
}

/**
 * The MCP counterpart of the `AGENTS.md` section: the same steps, but each skill runs with
 * `--mcp`, which names the tools of this server instead of CLI commands, and the tests are a tool
 * call. MCP clients truncate server instructions (Claude Code cuts them at 2,048 chars), so
 * anything more belongs in the skills and the tool results.
 */
export function buildServerInstructions(inputs: ServerInstructionsInputs): string {
  // Persistent context, like the plugin's SKILL.md: by the final answer, the skill and the
  // review-create result are many calls back, and agents left the review lines out. A review is
  // only published when the user asks for one, through the `ui-review` skill.
  const review = `\n\nWhen you create a review with \`${getToolName({ transport: 'mcp' })('review.create')}\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.`;
  // The tools are at hand over MCP, so an agent can do a step without its skill. It did for a
  // request that is one step, where no file edit comes first. With `component-docs` the workflow
  // has two skill steps, without it one.
  const skillFirst = inputs.docsEnabled
    ? '\n\nRun the skill of a step before you call a tool of that step, also when the request is only that step.'
    : '\n\nRun the skill before you call a tool of its step, also when the request is only that step.';
  // Over MCP there is no skill description to say when to open a skill, and Claude Code loads tool
  // descriptions only on use, so the triggers that skill descriptions carry are here.
  const triggers = [
    '`npx storybook skills ui-review --mcp` when the user asks for a review, or to see or be shown components, stories, or their states in Storybook',
    inputs.docsEnabled &&
      "`npx storybook skills component-docs --mcp` when the user asks about a component's props, API, or usage",
  ].filter(Boolean);
  return `${buildWorkflow(inputs, 'mcp')}${skillFirst}\n\nAlso run ${triggers.join(', and ')}.${review}`;
}
