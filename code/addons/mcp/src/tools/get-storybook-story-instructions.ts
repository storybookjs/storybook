import { resolveSkillInputs } from 'storybook/internal/core-server';
import { buildUiWorkflowSkill } from 'storybook/internal/skills';
import type { Options } from 'storybook/internal/types';
import type { McpServer } from 'tmcp';
import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tool-names.ts';

type BuildStorybookStoryInstructionsOptions = {
  toolsets?: AddonContext['toolsets'];
  a11yEnabled?: boolean;
  addonVitestAvailable?: boolean;
  /** Whether the documentation tools (`docs-list`, etc.) are registered. */
  docsEnabled?: boolean;
};

export async function addGetUIBuildingInstructionsTool(
  server: McpServer<any, AddonContext>,
  enabled: Parameters<McpServer<any, AddonContext>['tool']>[0]['enabled'] = () =>
    server.ctx.custom?.toolsets?.dev ?? true,
  {
    docsEnabled = false,
    addonVitestAvailable = false,
  }: { docsEnabled?: boolean; addonVitestAvailable?: boolean } = {}
) {
  server.tool(
    {
      name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
      title: 'Storybook UI workflow',
      get description() {
        const testSupported = (server.ctx.custom?.toolsets?.test ?? true) && addonVitestAvailable;
        const a11yAvailable = testSupported && (server.ctx.custom?.a11yEnabled ?? false);

        return getStorybookStoryInstructionsDescription({
          testSupported,
          a11yAvailable,
          docsEnabled: (server.ctx.custom?.toolsets?.docs ?? true) && docsEnabled,
        });
      },
      enabled,
    },
    async () => {
      try {
        const { options, disableTelemetry } = server.ctx.custom ?? {};
        if (!options) {
          throw new Error('Options are required in addon context');
        }

        if (!disableTelemetry) {
          await collectTelemetry({
            event: 'tool:getUIBuildingInstructions',
            server,
            toolset: 'dev',
          });
        }

        const uiInstructions = await buildStorybookStoryInstructions(options, {
          toolsets: server.ctx.custom?.toolsets,
          a11yEnabled: server.ctx.custom?.a11yEnabled,
          addonVitestAvailable,
          docsEnabled,
        });

        return {
          content: [{ type: 'text' as const, text: uiInstructions }],
        };
      } catch (error) {
        return errorToMCPContent(error);
      }
    }
  );
}

export function getStorybookStoryInstructionsDescription({
  testSupported,
  a11yAvailable,
  docsEnabled,
}: {
  testSupported: boolean;
  a11yAvailable: boolean;
  docsEnabled: boolean;
}) {
  const tests = testSupported
    ? `
- You run or fix story tests${a11yAvailable ? ' or accessibility violations' : ''}.`
    : '';

  return `Storybook's workflow for UI changes in this project: ${docsEnabled ? 'look up the components to reuse, ' : ''}write and update stories, ${testSupported ? 'run story tests, ' : ''}and publish a review of the result. Also shows existing components or stories in a review.

Call it first, before you edit any file, and follow its result when:
- You create, change, or delete a component, story (any *.stories.* file), style, theme, or design token, or otherwise change how the UI looks. A shared file with no stories of its own still changes its consumers' stories.${tests}
- The user asks to see components or stories.

Read its result in its entirety: it is the mandatory, ordered workflow, with the tools each step calls.`;
}

export function getStorybookStoryInstructionsToolMetadata(options: {
  testSupported: boolean;
  a11yAvailable: boolean;
  docsEnabled: boolean;
}) {
  return {
    name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
    title: 'Storybook UI workflow',
    description: getStorybookStoryInstructionsDescription(options),
  };
}

/**
 * Thin adapter over the shared `buildUiWorkflowSkill` content builder: resolves this Storybook's
 * framework and availability probes through `resolveSkillInputs` (the same path the skills CLI
 * uses), then renders the ui-workflow skill with the MCP tool names, so both paths state one
 * workflow. Optional overrides (toolset gates, `addonVitestAvailable`, `docsEnabled`,
 * `a11yEnabled`) take priority when provided; omitted fields fall back to the probe so callers
 * cannot silently get the wrong prose by leaving a field off.
 */
export async function buildStorybookStoryInstructions(
  options: Options,
  {
    toolsets,
    a11yEnabled,
    addonVitestAvailable,
    docsEnabled,
  }: BuildStorybookStoryInstructionsOptions = {}
): Promise<string> {
  const inputs = await resolveSkillInputs(options);

  return buildUiWorkflowSkill({
    transport: 'mcp',
    framework: inputs.framework,
    csfFactories: inputs.csfFactories,
    previewFile: inputs.previewFile,
    typescript: inputs.typescript,
    docsEnabled: (toolsets?.docs ?? true) && (docsEnabled ?? inputs.docsEnabled),
    testSupported: (toolsets?.test ?? true) && (addonVitestAvailable ?? inputs.testSupported),
    a11yEnabled: a11yEnabled ?? inputs.a11yEnabled,
    moduleGraphSupported: inputs.moduleGraphSupported,
  });
}
