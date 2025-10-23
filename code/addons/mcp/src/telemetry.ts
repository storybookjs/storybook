import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { McpServer } from 'tmcp';
import type { AddonContext } from './types';

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
			clientInfo: server.currentClientInfo(),
			clientCapabilities: server.currentClientCapabilities(),
			...payload,
		});
	} catch (error) {
		logger.debug('Error collecting telemetry:', error);
	}
}
