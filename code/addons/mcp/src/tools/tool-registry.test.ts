/**
 * Registry-level contracts: what survives when a backing toolset is broken. A regression here was
 * invisible to the e2e happy paths, so it is pinned at the adapter seam. How an outcome's tag maps
 * onto the MCP `isError` flag is the generic unwrap's contract, pinned in `toolset-tools.test.ts`.
 */

import { clearToolsetRegistry, defineToolset, registerToolset } from 'storybook/open-service';
import * as v from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata, registerAddonMcpTools } from './tool-registry.ts';

const collectTelemetry = vi.hoisted(() => vi.fn());
vi.mock('../telemetry.ts', () => ({ collectTelemetry }));

const loggerError = vi.hoisted(() => vi.fn());
vi.mock('storybook/internal/node-logger', () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/** Registers a stub `test` toolset whose metadata resolution throws the given error. */
function registerTestToolsetThrowing(error: Error) {
  registerToolset(
    defineToolset({
      id: 'test',
      description: 'stub',
      telemetryGroup: 'test',
      methods: {
        run: {
          schema: v.object({}),
          description: () => {
            throw error;
          },
          handler: async () => ({ ok: true, data: {}, markdown: '' }),
        },
      },
    }) as any
  );
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

describe('a broken tool row', () => {
  // The availability gate claims test support while the `test` toolset never registered — the
  // wiring bug behind the addon-vitest installed-but-not-enabled outage.
  const context = {
    availability: { testSupported: true, docsEnabled: true, a11yEnabled: false },
  } as never;

  beforeEach(() => {
    registerCoreToolsetsForTest({ testToolset: false });
    loggerError.mockClear();
  });

  it('is dropped from registration with an error log, keeping every other tool served', async () => {
    const { server, tools } = makeServer();

    await expect(registerAddonMcpTools(server, context)).resolves.toBeUndefined();

    expect([...tools.keys()]).not.toContain('run-story-tests');
    expect([...tools.keys()]).toEqual(
      expect.arrayContaining(['preview-stories', 'list-all-documentation', 'get-documentation'])
    );
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('run-story-tests'));
  });

  it('is dropped from the storybook ai metadata instead of failing the build', () => {
    const metadata = getAddonToolMetadata(context);
    const names = metadata.map((tool) => tool.name);

    expect(names).not.toContain('run-story-tests');
    expect(names).toEqual(expect.arrayContaining(['preview-stories', 'list-all-documentation']));
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('run-story-tests'));
  });

  it('contains only the missing-toolset case: any other adapter failure still fails fast', () => {
    registerTestToolsetThrowing(new Error('broken description'));

    expect(() => getAddonToolMetadata(context)).toThrow('broken description');
  });
});

describe('run-story-tests over the registry', () => {
  // Availability narrowed so only rows whose toolsets are registered here resolve.
  const context = {
    availability: { testSupported: true, docsEnabled: false, a11yEnabled: false },
  } as never;

  beforeEach(() => {
    clearToolsetRegistry();
  });

  // One integration probe through the real `test` toolset: a crashed run must reach the MCP
  // client flagged as an error with the report rendered. The per-status tag mapping lives on the
  // definition (`test/definition.test.ts`), the tag-to-isError unwrap in `toolset-tools.test.ts`.
  it('flags a crashed run as an error result end to end', async () => {
    registerCoreToolsetsForTest({ testToolset: false });
    registerToolset(
      defineToolset({
        id: 'test',
        description: 'stub',
        telemetryGroup: 'test',
        methods: {
          run: {
            schema: v.object({}),
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

    const result = await tools.get('run-story-tests')!({});

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Error: vitest died' }]);
  });
});
