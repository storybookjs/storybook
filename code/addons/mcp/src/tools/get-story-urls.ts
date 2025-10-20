import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import { storyNameFromExport } from "storybook/internal/csf";
import type { Options, StoryIndex } from "storybook/internal/types";
import { logger } from "storybook/internal/node-logger";
import z from "zod";
import { collectTelemetry } from "../telemetry";

const inputStoriesSchema = z.array(
  z.object({
    exportName: z.string(),
    explicitStoryName: z.string().optional(),
    absoluteStoryPath: z.string(),
  }),
);

const outputUrlsSchema = z.array(z.string());

export const GET_STORY_URLS_TOOL_NAME = "get_story_urls";

export function registerStoryUrlsTool({
  server,
  options,
}: {
  server: McpServer;
  options: Options;
}) {
  const origin = `http://localhost:${options.port}`;
  logger.debug("MCP server origin:", origin);

  server.registerTool(
    GET_STORY_URLS_TOOL_NAME,
    {
      title: "Get stories' URLs",
      description: `Get the URL for one or more stories.`,
      inputSchema: {
        stories: inputStoriesSchema,
      },
      outputSchema: {
        urls: outputUrlsSchema,
      },
    },
    async ({ stories }, { sessionId }) => {
      const index: StoryIndex = await (
        await fetch(`${origin}/index.json`)
      ).json();

      const entriesList = Object.values(index.entries);
      logger.debug("index entries found:", entriesList.length);

      const result: z.infer<typeof outputUrlsSchema> = [];
      let foundStoryCount = 0;

      for (const {
        exportName,
        explicitStoryName,
        absoluteStoryPath,
      } of stories) {
        const relativePath = `./${path.relative(process.cwd(), absoluteStoryPath)}`;

        logger.debug("Searching for:");
        logger.debug({
          exportName,
          explicitStoryName,
          absoluteStoryPath,
          relativePath,
        });

        const foundStoryId = entriesList.find(
          (entry) =>
            entry.importPath === relativePath &&
            [explicitStoryName, storyNameFromExport(exportName)].includes(
              entry.name,
            ),
        )?.id;

        if (foundStoryId) {
          logger.debug("Found story ID:", foundStoryId);
          result.push(`${origin}/?path=/story/${foundStoryId}`);
          foundStoryCount++;
        } else {
          logger.debug("No story found");
          let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
          if (!explicitStoryName) {
            errorMessage += ` (did you forget to pass the explicit story name?)`;
          }
          result.push(errorMessage);
        }
      }

      await collectTelemetry({
        event: "tool:getStoryUrls",
        mcpSessionId: sessionId!,
        inputStoryCount: stories.length,
        outputStoryCount: foundStoryCount,
      });

      return {
        content: result.map((text) => ({
          type: "text",
          text,
        })),
        // Note: Claude Code seems to ignore structuredContent at the moment https://github.com/anthropics/claude-code/issues/4427
        structuredContent: { urls: result },
      };
    },
  );
}
