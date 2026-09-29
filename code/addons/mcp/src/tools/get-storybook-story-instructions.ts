import { resolveSkillInputs } from 'storybook/internal/core-server';
import { buildStoryInstructions } from 'storybook/internal/skills';
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
  /**
   * Per-channel review gate override (per-request context on the MCP path, the
   * CLI default on the metadata path). Defaults to the explicit feature-flag gate.
   */
  reviewEnabled?: boolean;
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
      title: 'Storybook Story Development Instructions',
      get description() {
        const testSupported = (server.ctx.custom?.toolsets?.test ?? true) && addonVitestAvailable;
        const a11yAvailable = testSupported && (server.ctx.custom?.a11yEnabled ?? false);

        return getStorybookStoryInstructionsDescription({
          testSupported,
          a11yAvailable,
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
          reviewEnabled: server.ctx.custom?.reviewEnabled,
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
}: {
  testSupported: boolean;
  a11yAvailable: boolean;
}) {
  const criticalTestBullets = testSupported
    ? `
- Running story tests or fixing test failures`
    : '';
  const criticalA11yBullets = a11yAvailable
    ? `
- Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)`
    : '';

  const testAndA11yGuidance = testSupported
    ? `
- How to handle test failures${a11yAvailable ? ' and accessibility violations' : ''}`
    : '';

  return `Get comprehensive instructions for writing, testing, and fixing Storybook stories (.stories.tsx, .stories.ts, .stories.jsx, .stories.js, .stories.svelte, .stories.vue files).

CRITICAL: You MUST call this tool before:
- Creating new Storybook stories or story files
- Updating or modifying existing Storybook stories
- Adding new story variants or exports to story files
- Editing any file matching *.stories.* patterns
- Writing components that will need stories
- Editing anything that changes how the UI looks — components, styles, CSS, themes, colors, or design tokens; a shared file with no stories of its own still changes its consumers' stories${criticalTestBullets}${criticalA11yBullets}

This tool provides essential Storybook-specific guidance including:
- How to structure stories correctly for Storybook 9
- Required imports (Meta, StoryObj from framework package)
- Test utility imports (from 'storybook/test')
- Story naming conventions and best practices
- Play function patterns for interactive testing
- Mocking strategies for external dependencies
- Story variants and coverage requirements${testAndA11yGuidance}

Even if you're familiar with Storybook, call this tool to ensure you're following the correct patterns, import paths, and conventions for this specific Storybook setup.`;
}

export function getStorybookStoryInstructionsToolMetadata(options: {
  testSupported: boolean;
  a11yAvailable: boolean;
}) {
  return {
    name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
    title: 'Storybook Story Development Instructions',
    description: getStorybookStoryInstructionsDescription(options),
  };
}

/**
 * Thin adapter over the shared `buildStoryInstructions` content builder: resolves this
 * Storybook's framework/renderer and availability probes through `resolveSkillInputs` (the same
 * path the skills CLI uses), then renders the MCP-flavored prose. Optional overrides
 * (`reviewEnabled`, toolset gates, `addonVitestAvailable`, `docsEnabled`, `a11yEnabled`) take
 * priority when provided; omitted fields fall back to the probe so callers cannot silently get
 * the wrong prose by leaving a field off.
 */
export async function buildStorybookStoryInstructions(
  options: Options,
  {
    toolsets,
    a11yEnabled,
    addonVitestAvailable,
    docsEnabled,
    reviewEnabled: reviewEnabledOverride,
  }: BuildStorybookStoryInstructionsOptions = {}
): Promise<string> {
  const inputs = await resolveSkillInputs(options);

  return buildStoryInstructions({
    transport: 'mcp',
    framework: inputs.framework,
    renderer: inputs.renderer,
    changeDetectionEnabled: inputs.changeDetectionEnabled,
    reviewEnabled: reviewEnabledOverride ?? inputs.reviewEnabled,
    testSupported: (toolsets?.test ?? true) && (addonVitestAvailable ?? inputs.testSupported),
    a11yEnabled: a11yEnabled ?? inputs.a11yEnabled,
    docsEnabled: (toolsets?.docs ?? true) && (docsEnabled ?? inputs.docsEnabled),
  });
}
