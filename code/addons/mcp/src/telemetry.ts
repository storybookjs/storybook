import { logger } from '@storybook/core/internal/node-logger';
import { telemetry } from '@storybook/core/internal/telemetry';
import type { McpServer } from 'tmcp';
import type { AddonContext } from './types.ts';

export async function collectTelemetry({
  event,
  server,
  ...payload
}: {
  event: string;
  server: McpServer<any, AddonContext>;
  [key: string]: any;
}) {
  try {
    return await telemetry('addon-mcp' as any, {
      event,
      mcpSessionId: server.ctx.sessionId,
      clientInfo: server.ctx.sessionInfo?.clientInfo,
      clientCapabilities: server.ctx.sessionInfo?.clientCapabilities,
      transport: 'mcp',
      ...payload,
    });
  } catch (error) {
    logger.debug(`Error collecting telemetry: ${String(error)}`);
  }
}
