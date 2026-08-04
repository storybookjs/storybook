import url from 'node:url';
import fs from 'node:fs/promises';

import type { McpServer } from 'tmcp';

import type { AddonContext } from '../types.ts';
import appTemplate from './preview-stories/preview-stories-app-template.html';
import { PREVIEW_STORIES_TOOL_NAME } from './tool-names.ts';

export const PREVIEW_STORIES_RESOURCE_URI = `ui://${PREVIEW_STORIES_TOOL_NAME}/preview.html`;

/**
 * Serves the MCP app that renders story previews inline in the client.
 *
 * The app reads the tool result's `structuredContent`, so it is bound to the preview tool's output
 * contract rather than to its implementation.
 */
export async function addPreviewStoriesResource(server: McpServer<any, AddonContext>) {
  const previewStoryAppScript = await fs.readFile(
    url.fileURLToPath(
      import.meta.resolve('@storybook/addon-mcp/internal/preview-stories-app-script')
    ),
    'utf-8'
  );

  const appHtml = appTemplate.replace('// APP_SCRIPT_PLACEHOLDER', previewStoryAppScript);

  server.resource(
    {
      name: PREVIEW_STORIES_RESOURCE_URI,
      description: 'App resource for the Preview Stories tool',
      uri: PREVIEW_STORIES_RESOURCE_URI,
      mimeType: 'text/html;profile=mcp-app',
    },
    () => {
      const origin = server.ctx.custom!.origin;
      return {
        contents: [
          {
            uri: PREVIEW_STORIES_RESOURCE_URI,
            mimeType: 'text/html;profile=mcp-app',
            text: appHtml,
            _meta: {
              ui: {
                prefersBorder: false,
                domain: origin,
                csp: {
                  connectDomains: [origin],
                  resourceDomains: [origin],
                  frameDomains: [origin],
                  baseUriDomains: [origin],
                },
              },
            },
          },
        ],
      };
    }
  );
}
