import { resolveSkillInputs, type ToolAvailability } from 'storybook/internal/core-server';
import {
  buildComponentDocsSkill,
  buildUiWorkflowSkill,
  COMPONENT_DOCS_TOOL_NAME,
  getSkillToolDescriptions,
  UI_WORKFLOW_TOOL_NAME,
} from 'storybook/internal/skills';
import type { McpServer } from 'tmcp';
import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonToolDefinition, ToolMetadata } from './tool-registry.ts';

type Server = McpServer<any, AddonContext>;

/**
 * Which tools the skill texts may name: the gates the registry registers them with, for the
 * toolsets that are on (per request, `X-MCP-Toolsets` can turn some off).
 */
function getSkillGates(availability: ToolAvailability, toolsets: AddonContext['toolsets']) {
  return {
    devEnabled: toolsets?.dev ?? true,
    testSupported: (toolsets?.test ?? true) && availability.testSupported,
    docsEnabled: (toolsets?.docs ?? true) && availability.docsEnabled,
  };
}

function getMetadata(
  name: typeof UI_WORKFLOW_TOOL_NAME | typeof COMPONENT_DOCS_TOOL_NAME,
  availability: ToolAvailability,
  toolsets: AddonContext['toolsets']
): ToolMetadata {
  const descriptions = getSkillToolDescriptions(getSkillGates(availability, toolsets));
  return name === UI_WORKFLOW_TOOL_NAME
    ? { name, title: 'Storybook UI workflow', description: descriptions.uiWorkflow }
    : { name, title: 'Storybook component docs', description: descriptions.componentDocs };
}

async function buildSkillText(
  server: Server,
  name: typeof UI_WORKFLOW_TOOL_NAME | typeof COMPONENT_DOCS_TOOL_NAME,
  availability: ToolAvailability
): Promise<string> {
  const custom = server.ctx.custom;
  const gates = getSkillGates(availability, custom?.toolsets);
  if (name === COMPONENT_DOCS_TOOL_NAME) {
    return buildComponentDocsSkill('mcp', { uiWorkflowTool: gates.devEnabled });
  }
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
    moduleGraphSupported: availability.moduleGraphSupported,
  });
}

/**
 * A tool that returns a skill, rendered with the names of the tools this server registers for the
 * request, so an agent without a shell, or without the skills installed, gets the same workflow.
 */
function skillToolDefinition(
  name: typeof UI_WORKFLOW_TOOL_NAME | typeof COMPONENT_DOCS_TOOL_NAME,
  definition: Pick<AddonToolDefinition, 'toolset' | 'available'> & { mcpEventName: string }
): AddonToolDefinition {
  const { mcpEventName, ...rest } = definition;
  return {
    ...rest,
    name,
    getMetadata: ({ availability, toolsets }) => getMetadata(name, availability, toolsets),
    register: async (server, { availability }, enabled) => {
      const metadata = () => getMetadata(name, availability, server.ctx.custom?.toolsets);
      server.tool(
        {
          name,
          title: metadata().title ?? name,
          get description() {
            return metadata().description ?? '';
          },
          enabled,
        },
        async () => {
          try {
            if (!server.ctx.custom?.disableTelemetry) {
              await collectTelemetry({ event: mcpEventName, server, toolset: definition.toolset });
            }
            const text = await buildSkillText(server, name, availability);
            return { content: [{ type: 'text' as const, text }] };
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
  skillToolDefinition(UI_WORKFLOW_TOOL_NAME, {
    toolset: 'dev',
    mcpEventName: 'tool:getUIBuildingInstructions',
  }),
  skillToolDefinition(COMPONENT_DOCS_TOOL_NAME, {
    toolset: 'docs',
    available: ({ availability }) => availability.docsEnabled,
    mcpEventName: 'tool:getComponentDocsInstructions',
  }),
];
