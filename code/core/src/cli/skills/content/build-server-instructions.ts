import { getToolName } from '../../../shared/open-service/toolset-names.ts';
import type { SkillId } from './skills.ts';

export type ServerInstructionsInputs = {
  devEnabled: boolean;
  testSupported: boolean;
  docsEnabled: boolean;
};

/** The MCP tools that serve the `ui-workflow` and `component-docs` skills, under their names. */
export const UI_WORKFLOW_TOOL_NAME = 'ui-workflow' satisfies SkillId;
export const COMPONENT_DOCS_TOOL_NAME = 'component-docs' satisfies SkillId;

/**
 * When to call each skill tool and what it does, in the words of the `## Storybook` section that
 * `create storybook` writes in `AGENTS.md`. The server instructions and the tool descriptions both
 * use them, as some MCP clients show only one of the two.
 */
function getSkillToolTasks({
  testSupported,
  docsEnabled,
}: Omit<ServerInstructionsInputs, 'devEnabled'>) {
  const steps = [
    docsEnabled && 'looks up the components to reuse',
    'updates your stories',
    testSupported && 'runs the tests',
    'publishes a review of the results',
  ].filter(Boolean);
  const workflow = `${steps.slice(0, -1).join(', ')}${steps.length > 2 ? ',' : ''} and ${steps.at(-1)}`;

  return {
    uiWorkflow: {
      when: `you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks;${testSupported ? ' you run or fix story tests;' : ''} or the user asks to see components or stories`,
      workflow,
      does: `It ${workflow}.`,
    },
    componentDocs: {
      when: "you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage",
      does: "It lists the project's components with their props and usage examples.",
    },
  };
}

/**
 * The descriptions of the skill tools: what each one returns, then when to call it. The tools return
 * instructions, so they say what the instructions do rather than what the tool does.
 */
export function getSkillToolDescriptions(inputs: Omit<ServerInstructionsInputs, 'devEnabled'>) {
  const { uiWorkflow, componentDocs } = getSkillToolTasks(inputs);
  const describe = (returns: string, when: string) =>
    `${returns} Read the whole result.\n\nCall it first, before you edit any file, and follow its result when ${when}.`;
  return {
    uiWorkflow: describe(
      `Returns Storybook's workflow for UI changes in this project, which ${uiWorkflow.workflow}.`,
      uiWorkflow.when
    ),
    componentDocs: describe(
      "Returns how to look up this project's components, with their props and usage examples.",
      componentDocs.when
    ),
  };
}

/**
 * The MCP counterpart of the `## Storybook` section that `create storybook` writes in `AGENTS.md`:
 * the same tasks in the same words, but each one calls the tool of this server that serves its
 * skill, which names the tools of this server instead of CLI commands. MCP clients truncate server
 * instructions (Claude Code cuts them at 2,048 chars), so anything more belongs in the skills.
 */
export function buildServerInstructions({
  devEnabled,
  testSupported,
  docsEnabled,
}: ServerInstructionsInputs): string {
  const ref = getToolName({ transport: 'mcp' });
  const { uiWorkflow, componentDocs } = getSkillToolTasks({ testSupported, docsEnabled });

  const tasks = [
    devEnabled && `- \`${UI_WORKFLOW_TOOL_NAME}\`: ${uiWorkflow.when}. ${uiWorkflow.does}`,
    !devEnabled &&
      testSupported &&
      `- \`${ref('test.run')}\`: you run or fix story tests. It is the only way to run them, never a \`package.json\` test script; finish with one run without \`stories\`, and never finish with failing tests.`,
    docsEnabled &&
      `- \`${COMPONENT_DOCS_TOOL_NAME}\`: ${componentDocs.when}. ${componentDocs.does}`,
  ].filter(Boolean);

  if (tasks.length === 0) {
    return '';
  }

  return `## Storybook

For ${tasks.length > 1 ? 'each of these tasks' : 'this task'}, call its Storybook tool first, before you edit any file, and follow its result:

${tasks.join('\n')}`;
}
