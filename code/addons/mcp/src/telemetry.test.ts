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
        sessionInfo: {
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
          clientCapabilities: {
            experimental: {},
            roots: { listChanged: true },
          },
        },
      },
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
      consumer: 'mcp',
    });
  });

  it('reports the storybook ai CLI channel as the cli consumer', async () => {
    vi.mocked(telemetry).mockResolvedValue(undefined);

    const cliServer = Object.assign(Object.create(mockServer), {
      ctx: { ...mockServer.ctx, custom: { cliClient: true } },
    }) as any;

    await collectTelemetry({ event: 'test-event', server: cliServer });

    expect(telemetry).toHaveBeenCalledWith(
      'addon-mcp',
      expect.objectContaining({ consumer: 'cli' })
    );
  });

  it('should pass through additional payload fields', async () => {
    vi.mocked(telemetry).mockResolvedValue(undefined);

    await collectTelemetry({
      event: 'tool-called',
      server: mockServer,
      toolName: 'list-all-documentation',
      duration: 123,
      success: true,
    });

    expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
      event: 'tool-called',
      mcpSessionId: 'test-session-123',
      clientInfo: expect.any(Object),
      clientCapabilities: expect.any(Object),
      toolName: 'list-all-documentation',
      duration: 123,
      success: true,
      consumer: 'mcp',
    });
  });

  it('should catch and log errors from telemetry', async () => {
    const error = new Error('Telemetry failed');
    vi.mocked(telemetry).mockRejectedValue(error);

    await expect(
      collectTelemetry({
        event: 'test-event',
        server: mockServer,
      })
    ).resolves.not.toThrow();

    expect(logger.debug).toHaveBeenCalledWith(`Error collecting telemetry: ${error}`);
  });

  it('should handle missing session ID gracefully', async () => {
    vi.mocked(telemetry).mockResolvedValue(undefined);

    const serverWithoutSession = Object.assign(Object.create(mockServer), {
      ctx: {},
    }) as any;

    await collectTelemetry({
      event: 'test-event',
      server: serverWithoutSession,
    });

    expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
      event: 'test-event',
      mcpSessionId: undefined,
      clientInfo: undefined,
      clientCapabilities: undefined,
      consumer: 'mcp',
    });
  });
});
