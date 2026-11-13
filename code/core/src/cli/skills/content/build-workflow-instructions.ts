import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillId } from './skills.ts';
import type { SkillTextTransport } from './skill-vocabulary.ts';

export type ServerInstructionsInputs = {
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

// A step either opens a skill or, for the tests, names the command itself: an agent runs the
// tests right from that line, without a skill in between.
type Step = { skill: SkillId; does: string; also?: string } | { tests: true };

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
    testSupported && { tests: true },
    // No review step: publishing one after every change costs tokens also when nobody looks at
    // it, and it needs a running dev server. The `ui-review` skill stays for when the user asks.
  ];
  return steps.filter((step) => step !== false);
}

// The test step names the command, with one line per file form, so an agent runs the right tests
// from this text alone. The rules for failures and accessibility violations come with the output
// of the command, when they apply.
function testStep(number: number, transport: SkillTextTransport): string {
  const does = `${number}. Run the story tests after every change, and fix what fails. Also when the user asks to run or fix story tests.`;
  // An agent without this rule runs the test script of the project.
  const never = 'never a `package.json` test script or `vitest`';
  if (transport === 'mcp') {
    const run = `\`${getToolName({ transport })('test.run')}\``;
    return `${does} Call ${run} for them, ${never}. Pass the story files or component files you changed in \`files\`: a story file selects the stories in it, any other file every story that depends on it, and no \`files\` every story.`;
  }
  return `${does} Run them only with this command, from the package where Storybook is installed, ${never}. Pass the files you changed:
   - \`npx storybook tools test run <Button.stories.tsx>\`: the stories in that story file.
   - \`npx storybook tools test run <Button.tsx>\`: every story that depends on that file.
   - \`npx storybook tools test run\`: every story.`;
}

// The workflow that ties the skills together, in the order an agent takes the steps. A project
// edits it to change the workflow.
function buildWorkflow(inputs: ServerInstructionsInputs, transport: SkillTextTransport): string {
  const cli = transport === 'cli';
  const steps = workflowSteps(inputs);
  const lines = steps.map((step, index) =>
    'tests' in step
      ? testStep(index + 1, transport)
      : `${index + 1}. \`${cli ? step.skill : `npx storybook skills ${step.skill} --mcp`}\`: ${step.does}.${step.also ? ` Also when ${step.also}.` : ''}`
  );
  const skillSteps = steps.flatMap((step, index) => ('skill' in step ? [index + 1] : []));
  const inOwnCommand =
    'in a command of its own, from the package where Storybook is installed, and read its whole output, without `head` or `tail`';
  // An agent opens the skills it is told to open at the start of its task. One it has to open
  // halfway is the one it skips, so all of them come first, in a sentence of their own.
  let open =
    skillSteps.length > 1
      ? cli
        ? `First invoke the skills of steps ${skillSteps.join(' and ')}, before you edit any file. Then follow each skill at its step.`
        : `First run the skills of steps ${skillSteps.join(' and ')}, before you edit any file: each ${inOwnCommand}. Then follow each skill at its step.`
      : skillSteps.length === 1
        ? cli
          ? `First invoke the skill of step ${skillSteps[0]}, before you edit any file. Then follow it at its step.`
          : `First run the skill of step ${skillSteps[0]}, before you edit any file, ${inOwnCommand}. Then follow it at its step.`
        : '';
  if (steps.length === 1 && skillSteps.length === 1) {
    open = cli
      ? 'It has a Storybook skill. Invoke it before you edit any file, and follow it.'
      : `It has a Storybook skill. Run it before you edit any file, ${inOwnCommand}, and follow it.`;
  }
  const follow = steps.length > 1 ? 'follow these steps in order.' : 'follow this step.';
  return `## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), ${[follow, open].filter(Boolean).join(' ')}

${lines.join('\n')}`;
}

/**
 * The `## Storybook` section that `create storybook` and `storybook upgrade` write in `AGENTS.md`.
 * Without `@storybook/addon-vitest` the project cannot run story tests, so it gets no test step.
 */
export function buildAgentInstructions({ testSupported = true } = {}): string {
  return buildWorkflow({ devEnabled: true, testSupported, docsEnabled: true }, 'cli');
}

/**
 * The MCP counterpart of the `AGENTS.md` section: the same steps, but each skill runs with
 * `--mcp`, which names the tools of this server instead of CLI commands, and the tests are a tool
 * call. MCP clients truncate server instructions (Claude Code cuts them at 2,048 chars), so
 * anything more belongs in the skills and the tool results.
 */
export function buildServerInstructions(inputs: ServerInstructionsInputs): string {
  if (!inputs.devEnabled && !inputs.testSupported && !inputs.docsEnabled) {
    return '';
  }
  // Persistent context, like the plugin's SKILL.md: by the final answer, the skill and the
  // review-create result are many calls back, and agents left the review lines out. A review is
  // only published when the user asks for one, through the `ui-review` skill.
  const review = inputs.devEnabled
    ? `\n\nWhen you publish a review with \`${getToolName({ transport: 'mcp' })('review.create')}\`, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.`
    : '';
  // The tools are at hand over MCP, so an agent can do a step without its skill. It did for a
  // request that is one step, where no file edit comes first.
  const skillSteps = workflowSteps(inputs).filter((step) => 'skill' in step).length;
  const skillFirst =
    skillSteps === 0
      ? ''
      : skillSteps > 1
        ? '\n\nRun the skill of a step before you call a tool of that step, also when the request is only that step.'
        : '\n\nRun the skill before you call a tool of its step, also when the request is only that step.';
  return `${buildWorkflow(inputs, 'mcp')}${skillFirst}${review}`;
}
