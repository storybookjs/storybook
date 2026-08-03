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

/** Registers a stub `stories` toolset whose metadata resolution throws the given error. */
function registerStoriesToolsetThrowing(error: Error) {
  registerToolset(
    defineToolset({
      id: 'stories',
      description: 'stub',
      telemetryGroup: 'dev',
      methods: {
        changed: {
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
  // The availability gate claims change detection while the `stories` toolset never registered —
  // the wiring bug this containment exists for.
  const context = {
    availability: { changeDetectionEnabled: true, docsEnabled: true, a11yEnabled: false },
  } as never;

  beforeEach(() => {
    clearToolsetRegistry();
    loggerError.mockClear();
  });

  it('is dropped from registration with an error log, keeping every other tool served', async () => {
    const { server, tools } = makeServer();

    await expect(registerAddonMcpTools(server, context)).resolves.toBeUndefined();

    expect([...tools.keys()]).not.toContain('get-changed-stories');
    expect([...tools.keys()]).toEqual(
      expect.arrayContaining(['preview-stories', 'list-all-documentation', 'get-documentation'])
    );
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('get-changed-stories'));
  });

  it('is dropped from the storybook ai metadata instead of failing the build', () => {
    const metadata = getAddonToolMetadata(context);
    const names = metadata.map((tool) => tool.name);

    expect(names).not.toContain('get-changed-stories');
    expect(names).toEqual(expect.arrayContaining(['preview-stories', 'list-all-documentation']));
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('get-changed-stories'));
  });

  it('contains only the missing-toolset case: any other adapter failure still fails fast', () => {
    registerStoriesToolsetThrowing(new Error('broken description'));

    expect(() => getAddonToolMetadata(context)).toThrow('broken description');
  });
});

describe('get-changed-stories over the registry', () => {
  beforeEach(() => {
    clearToolsetRegistry();
  });

  // One integration probe through the real `stories` toolset: the row resolves off the registry
  // and publishes the frozen name and title an MCP client sees.
  it('serves the migrated row once its toolset is registered', async () => {
    registerCoreToolsetsForTest();
    const { server, tools } = makeServer();

    await registerAddonMcpTools(server, {
      availability: { changeDetectionEnabled: true, docsEnabled: false, a11yEnabled: false },
    } as never);

    expect(tools.has('get-changed-stories')).toBe(true);
    expect(
      getAddonToolMetadata({
        availability: { changeDetectionEnabled: true, docsEnabled: false, a11yEnabled: false },
      } as never).find((tool) => tool.name === 'get-changed-stories')
    ).toMatchObject({ title: 'Get changed stories metadata' });
  });
});
