/**
 * Registry-level contracts: what survives when a backing toolset is broken. A regression here was
 * invisible to the e2e happy paths, so it is pinned at the adapter seam. How an outcome's tag maps
 * onto the MCP `isError` flag is the generic unwrap's contract, pinned in `toolset-tools.test.ts`.
 */

import { logger } from 'storybook/internal/node-logger';

import { clearToolsetRegistry, defineToolset, registerToolset } from 'storybook/open-service';
import * as v from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolAvailability } from 'storybook/internal/core-server';
import { collectTelemetry } from '../telemetry.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import {
  type AddonToolRegistryContext,
  getAddonToolMetadata,
  registerAddonMcpTools,
} from './tool-registry.ts';

vi.mock('../telemetry.ts', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const loggerError = vi.mocked(logger.error);

beforeEach(() => {
  vi.mocked(collectTelemetry).mockResolvedValue(undefined);
  loggerError.mockImplementation(() => {});
});

/** Registers a stub `test` toolset whose metadata resolution throws the given error. */
function registerTestToolsetThrowing(error: Error) {
  registerToolset(
    defineToolset({
      id: 'test',
      description: 'stub',
      methods: {
        run: {
          input: v.object({}),
          title: 'Storybook Tests',
          description: () => {
            throw error;
          },
          handler: async () => ({ ok: true, data: {}, markdown: '' }),
        },
      },
    }) as any
  );
}

/** A fully-typed availability with every gate closed; open individual gates per describe. */
function availabilityWith(overrides: Partial<ToolAvailability> = {}): ToolAvailability {
  return {
    moduleGraphSupported: false,
    changeDetectionEnabled: false,
    reviewEnabled: false,
    reviewEnabledForCli: false,
    docsEnabled: false,
    docsEnabledForCli: false,
    docsHasManifests: false,
    docsFeatureEnabled: false,
    testSupported: false,
    a11yEnabled: false,
    docgenServer: false,
    ...overrides,
  };
}

function makeServer() {
  const tools = new Map<string, (input: unknown) => Promise<any>>();
  const server = {
    ctx: { custom: { origin: 'http://localhost:6006' }, sessionId: 'session-1' },
    tool: (metadata: { name: string }, handler: (input: unknown) => Promise<any>) => {
      tools.set(metadata.name, handler);
    },
    resource: () => {},
  } as any;

  return { server, tools };
}

describe('a broken tool definition', () => {
  // The availability gate claims test support while the `test` toolset never registered — the
  // wiring bug behind the addon-vitest installed-but-not-enabled outage.
  const context: AddonToolRegistryContext = {
    availability: availabilityWith({ testSupported: true, docsEnabled: true }),
  };

  beforeEach(() => {
    registerCoreToolsetsForTest();
    loggerError.mockClear();
  });

  it('is dropped from registration with an error log, keeping every other tool served', async () => {
    const { server, tools } = makeServer();

    await expect(registerAddonMcpTools(server, context)).resolves.toBeUndefined();

    expect([...tools.keys()]).not.toContain('test-run');
    expect([...tools.keys()]).toEqual(
      expect.arrayContaining(['stories-preview', 'docs-list', 'docs-show'])
    );
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('test-run'));
  });

  it('is dropped from the storybook ai metadata instead of failing the build', () => {
    const metadata = getAddonToolMetadata(context);
    const names = metadata.map((tool) => tool.name);

    expect(names).not.toContain('test-run');
    expect(names).toEqual(expect.arrayContaining(['stories-preview', 'docs-list']));
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('test-run'));
  });

  it('contains only the missing-toolset case: any other adapter failure still fails fast', () => {
    registerTestToolsetThrowing(new Error('broken description'));

    expect(() => getAddonToolMetadata(context)).toThrow('broken description');
  });
});

describe('the preview app resource', () => {
  beforeEach(() => {
    registerCoreToolsetsForTest();
  });

  it('is registered only when the preview tool can be available at boot', async () => {
    const enabled = makeServer();
    const enabledResource = vi.fn();
    enabled.server.resource = enabledResource;
    await registerAddonMcpTools(enabled.server, { availability: availabilityWith() });
    expect(enabledResource).toHaveBeenCalledTimes(1);

    const reviewEnabled = makeServer();
    const reviewEnabledResource = vi.fn();
    reviewEnabled.server.resource = reviewEnabledResource;
    await registerAddonMcpTools(reviewEnabled.server, {
      availability: availabilityWith({ reviewEnabled: true }),
    });
    expect(reviewEnabledResource).not.toHaveBeenCalled();

    const devDisabled = makeServer();
    const devDisabledResource = vi.fn();
    devDisabled.server.resource = devDisabledResource;
    await registerAddonMcpTools(devDisabled.server, {
      availability: availabilityWith(),
      toolsets: { dev: false, docs: true, test: true },
    });
    expect(devDisabledResource).not.toHaveBeenCalled();
  });

  it('follows the preview tool per-request gates', async () => {
    const { server } = makeServer();
    const resource = vi.fn();
    server.resource = resource;

    await registerAddonMcpTools(server, { availability: availabilityWith() });

    const definition = resource.mock.calls[0]![0];
    expect(await definition.enabled()).toBe(true);

    server.ctx.custom.reviewEnabled = true;
    expect(await definition.enabled()).toBe(false);

    server.ctx.custom.reviewEnabled = false;
    server.ctx.custom.toolsets = { dev: false };
    expect(await definition.enabled()).toBe(false);
  });
});

describe('test-run over the registry', () => {
  // Availability narrowed so only tools whose toolsets are registered here resolve.
  const context: AddonToolRegistryContext = {
    availability: availabilityWith({ testSupported: true }),
  };

  beforeEach(() => {
    clearToolsetRegistry();
  });

  // One integration probe through the real `test` toolset: a crashed run must reach the MCP
  // client flagged as an error with the report rendered. The per-status tag mapping lives on the
  // definition (`test/definition.test.ts`), the tag-to-isError unwrap in `toolset-tools.test.ts`.
  it('flags a crashed run as an error result end to end', async () => {
    registerCoreToolsetsForTest();
    registerToolset(
      defineToolset({
        id: 'test',
        description: 'stub',
        methods: {
          run: {
            input: v.object({}),
            title: 'Storybook Tests',
            description: 'run',
            handler: async () => ({
              ok: false,
              data: { status: 'error', error: { message: 'vitest died' } },
              markdown: 'Error: vitest died',
            }),
          },
        },
      }) as any
    );
    const { server, tools } = makeServer();
    await registerAddonMcpTools(server, context);

    const result = await tools.get('test-run')!({});

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Error: vitest died' }]);
  });
});
