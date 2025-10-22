import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

export async function collectTelemetry({
	event,
	sessionId,
	client,
	...payload
}: {
	event: string;
	sessionId?: string;
	client?: string;
	[key: string]: any;
}) {
	try {
		return await telemetry('addon-mcp' as any, {
			event,
			sessionId,
			client,
			...payload,
		});
	} catch (error) {
		logger.debug('Error collecting telemetry:', error);
	}
}
