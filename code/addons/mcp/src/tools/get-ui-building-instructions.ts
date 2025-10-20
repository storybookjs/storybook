import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GET_STORY_URLS_TOOL_NAME } from "./get-story-urls";
import { collectTelemetry } from "../telemetry";
import uiInstructionsTemplate from "../ui-building-instructions.md";
import type { Options } from "storybook/internal/types";
import { logger } from "storybook/internal/node-logger";

export function registerUIBuildingTool({
  server,
  options,
}: {
  server: McpServer;
  options: Options;
}) {
  server.registerTool(
    "get_ui_building_instructions",
    {
      title: "UI Component Building Instructions",
      description: `Instructions on how to do UI component development. 
      
      ALWAYS call this tool before doing any UI/frontend/React/component development, including but not
      limited to adding or updating new components, pages, screens or layouts.`,
      inputSchema: {},
    },
    async (_, { sessionId }) => {
      await collectTelemetry({
        event: "tool:getUIBuildingInstructions",
        mcpSessionId: sessionId!,
      });

      const frameworkPreset = await options.presets.apply("framework");
      const framework =
        typeof frameworkPreset === "string"
          ? frameworkPreset
          : frameworkPreset?.name;
      const renderer = frameworkToRendererMap[framework!];

      if (!framework || !renderer) {
        logger.debug("Unable to determine framework or renderer", {
          frameworkPreset,
          framework,
          renderer,
        });
      }

      const uiInstructions = uiInstructionsTemplate
        .replace("{{FRAMEWORK}}", framework)
        .replace("{{RENDERER}}", renderer ?? framework)
        .replace("{{GET_STORY_URLS_TOOL_NAME}}", GET_STORY_URLS_TOOL_NAME);

      return {
        content: [{ type: "text", text: uiInstructions }],
      };
    },
  );
}

// TODO: this is a stupid map to maintain and it's not complete, but we can't easily get the current renderer name
const frameworkToRendererMap: Record<string, string> = {
  "@storybook/react-vite": "@storybook/react",
  "@storybook/react-webpack5": "@storybook/react",
  "@storybook/nextjs": "@storybook/react",
  "@storybook/nextjs-vite": "@storybook/react",
  "@storybook/react-native-web-vite": "@storybook/react",

  "@storybook/vue3-vite": "@storybook/vue3",
  "@nuxtjs/storybook": "@storybook/vue3",

  "@storybook/angular": "@storybook/angular",

  "@storybook/svelte-vite": "@storybook/svelte",
  "@storybook/sveltekit": "@storybook/svelte",

  "@storybook/preact-vite": "@storybook/preact",

  "@storybook/web-components-vite": "@storybook/web-components",

  "@storybook/html-vite": "@storybook/html",
};
