import { resolveSkillInputs, type ToolAvailability } from 'storybook/internal/core-server';
import {
  buildComponentDocsSkill,
  buildUiWorkflowSkill,
  COMPONENT_DOCS_TOOL_NAME,
  getSkillToolDescriptions,
  type ServerInstructionsInputs,
  UI_WORKFLOW_TOOL_NAME,
} from 'storybook/internal/skills';
import { toMcpToolName } from 'storybook/open-service';
import type { McpServer } from 'tmcp';
import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonToolDefinition } from './tool-registry.ts';

type Server = McpServer<any, AddonContext>;

export type SkillGates = ServerInstructionsInputs & { moduleGraphSupported: boolean };

/**
 * Which tools the skill texts and server instructions may name: the toolsets that are on for this
 * request (`X-MCP-Toolsets` can turn some off), and of those, the tools the registry registered.
 * Without the registered names (tool metadata for the landing page and docs), the availability
 * gates the registry registers them with.
 */
export function getSkillGates({
  availability,
  toolsets,
  registered,
}: {
  availability: ToolAvailability;
  toolsets?: AddonContext['toolsets'];
  registered?: ReadonlySet<string>;
}): SkillGates {
  const has = (method: Parameters<typeof toMcpToolName>[0], available: boolean) =>
    registered ? registered.has(toMcpToolName(method)) : available;
  const devEnabled = toolsets?.dev ?? true;
  return {
    devEnabled,
    testSupported: (toolsets?.test ?? true) && has('test.run', availability.testSupported),
    docsEnabled: (toolsets?.docs ?? true) && has('docs.list', availability.docsEnabled),
    moduleGraphSupported:
      devEnabled && has('stories.findByComponent', availability.moduleGraphSupported),
  };
}

type Skill = {
  name: typeof UI_WORKFLOW_TOOL_NAME | typeof COMPONENT_DOCS_TOOL_NAME;
  title: string;
  description: (gates: SkillGates) => string;
  render: (server: Server, gates: SkillGates) => Promise<string>;
  mcpEventName: string;
};

const UI_WORKFLOW: Skill = {
  name: UI_WORKFLOW_TOOL_NAME,
  title: 'Storybook UI workflow',
  description: (gates) => getSkillToolDescriptions(gates).uiWorkflow,
  render: async (server, gates) => {
    const custom = server.ctx.custom;
    if (!custom?.options) {
      throw new Error('Options are required in addon context');
    }
    const inputs = await resolveSkillInputs(custom.options);
    return buildUiWorkflowSkill({
      transport: 'mcp',
      framework: inputs.framework,
      csfFactories: inputs.csfFactories,
      previewFile: inputs.previewFile,
      typescript: inputs.typescript,
      docsEnabled: gates.docsEnabled,
      testSupported: gates.testSupported,
      a11yEnabled: custom.a11yEnabled ?? inputs.a11yEnabled,
      moduleGraphSupported: gates.moduleGraphSupported,
    });
  },
  // The event of `get-storybook-story-instructions`, the earlier name of this tool.
  mcpEventName: 'tool:getUIBuildingInstructions',
};

const COMPONENT_DOCS: Skill = {
  name: COMPONENT_DOCS_TOOL_NAME,
  title: 'Storybook component docs',
  description: (gates) => getSkillToolDescriptions(gates).componentDocs,
  render: async (_server, gates) =>
    buildComponentDocsSkill('mcp', {
      uiWorkflowTool: gates.devEnabled,
      testSupported: gates.testSupported,
    }),
  mcpEventName: 'tool:getComponentDocsInstructions',
};

/**
 * A tool that returns a skill, rendered with the names of the tools this server serves for the
 * request, so an agent without a shell, or without the skills installed, gets the same workflow.
 */
function skillToolDefinition(
  skill: Skill,
  definition: Pick<AddonToolDefinition, 'toolset' | 'available'>
): AddonToolDefinition {
  return {
    ...definition,
    name: skill.name,
    getMetadata: (context) => ({
      name: skill.name,
      title: skill.title,
      description: skill.description(getSkillGates(context)),
    }),
    register: async (server, { availability, registered }, enabled) => {
      const gates = () =>
        getSkillGates({ availability, toolsets: server.ctx.custom?.toolsets, registered });
      server.tool(
        {
          name: skill.name,
          title: skill.title,
          get description() {
            return skill.description(gates());
          },
          enabled,
        },
        async () => {
          try {
            if (!server.ctx.custom?.disableTelemetry) {
              await collectTelemetry({
                event: skill.mcpEventName,
                server,
                toolset: definition.toolset,
              });
            }
            return {
              content: [{ type: 'text' as const, text: await skill.render(server, gates()) }],
            };
          } catch (error) {
            return errorToMCPContent(error);
          }
        }
      );
    },
  };
}

export const skillToolDefinitions: AddonToolDefinition[] = [
  // The workflow publishes a review, so it comes with the dev toolset. Without it, the server
  // instructions point to `test-run` directly.
  skillToolDefinition(UI_WORKFLOW, { toolset: 'dev' }),
  skillToolDefinition(COMPONENT_DOCS, {
    toolset: 'docs',
    available: ({ availability }) => availability.docsEnabled,
  }),
];
