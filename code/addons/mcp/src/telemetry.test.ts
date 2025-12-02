import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpServer } from 'tmcp';
import type { AddonContext } from './types.ts';
import { collectTelemetry } from './telemetry.ts';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

describe('collectTelemetry', () => {
	let mockServer: McpServer<any, AddonContext>;

	beforeEach(() => {
		mockServer = {
			ctx: {
				sessionId: 'test-session-123',
			},
			currentClientInfo: vi.fn().mockReturnValue({
				name: 'test-client',
				version: '1.0.0',
			}),
			currentClientCapabilities: vi.fn().mockReturnValue({
				experimental: {},
				roots: { listChanged: true },
			}),
		} as any;
	});

	it('should call telemetry with correct parameters', async () => {
		vi.mocked(telemetry).mockResolvedValue(undefined);

		await collectTelemetry({
			event: 'test-event',
			server: mockServer,
			customField: 'custom-value',
		});

		expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
			event: 'test-event',
			mcpSessionId: 'test-session-123',
			clientInfo: {
				name: 'test-client',
				version: '1.0.0',
			},
			clientCapabilities: {
				experimental: {},
				roots: { listChanged: true },
			},
			customField: 'custom-value',
		});
	});

	it('should pass through additional payload fields', async () => {
		vi.mocked(telemetry).mockResolvedValue(undefined);

		await collectTelemetry({
			event: 'tool-called',
			server: mockServer,
			toolName: 'list-all-components',
			duration: 123,
			success: true,
		});

		expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
			event: 'tool-called',
			mcpSessionId: 'test-session-123',
			clientInfo: expect.any(Object),
			clientCapabilities: expect.any(Object),
			toolName: 'list-all-components',
			duration: 123,
			success: true,
		});
	});

	it('should catch and log errors from telemetry', async () => {
		const error = new Error('Telemetry failed');
		vi.mocked(telemetry).mockRejectedValue(error);

		await expect(
			collectTelemetry({
				event: 'test-event',
				server: mockServer,
			}),
		).resolves.not.toThrow();

		expect(logger.debug).toHaveBeenCalledWith(
			`Error collecting telemetry: ${error}`,
		);
	});

	it('should handle missing session ID gracefully', async () => {
		vi.mocked(telemetry).mockResolvedValue(undefined);

		const serverWithoutSession = {
			...mockServer,
			ctx: {},
		} as any;

		await collectTelemetry({
			event: 'test-event',
			server: serverWithoutSession,
		});

		expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
			event: 'test-event',
			mcpSessionId: undefined,
			clientInfo: expect.any(Object),
			clientCapabilities: expect.any(Object),
		});
	});
});
