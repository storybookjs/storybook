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
      transport: 'mcp',
    });
  });

  it('reports the storybook ai CLI channel as the cli transport', async () => {
    vi.mocked(telemetry).mockResolvedValue(undefined);

    const cliServer = Object.assign(Object.create(mockServer), {
      ctx: { ...mockServer.ctx, custom: { cliClient: true } },
    }) as any;

    await collectTelemetry({ event: 'test-event', server: cliServer });

    expect(telemetry).toHaveBeenCalledWith(
      'addon-mcp',
      expect.objectContaining({ transport: 'cli' })
    );
  });

  it('should pass through additional payload fields', async () => {
    vi.mocked(telemetry).mockResolvedValue(undefined);

    await collectTelemetry({
      event: 'tool-called',
      server: mockServer,
      // Stable analytics string — keep the historical MCP tool spelling even when the wire name
      // derived from the toolset method differs.
      toolName: 'docs-list',
      duration: 123,
      success: true,
    });

    expect(telemetry).toHaveBeenCalledWith('addon-mcp', {
      event: 'tool-called',
      mcpSessionId: 'test-session-123',
      clientInfo: expect.any(Object),
      clientCapabilities: expect.any(Object),
      toolName: 'docs-list',
      duration: 123,
      success: true,
      transport: 'mcp',
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
      transport: 'mcp',
    });
  });
});
