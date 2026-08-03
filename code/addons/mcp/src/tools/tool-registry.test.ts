/**
 * Registry-level contracts: what survives when a backing toolset is broken. A regression here was
 * invisible to the e2e happy paths, so it is pinned at the adapter seam. How an outcome's tag maps
 * onto the MCP `isError` flag is the generic unwrap's contract, pinned in `toolset-tools.test.ts`.
 */

import {
  clearToolsetRegistry,
  defineToolset,
  registerToolset,
  type ToolsetMethodDescription,
} from 'storybook/open-service';
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

/** Every MCP tool currently served from a core toolset. */
const TOOLSET_BACKED = ['preview-stories', 'get-changed-stories', 'get-stories-by-component'];

/** Registers a stub `stories` toolset whose metadata resolution throws the given error. */
function registerStoriesToolsetThrowing(error: Error) {
  const stubMethod = (description: ToolsetMethodDescription) => ({
    schema: v.object({}),
    description,
    handler: async () => ({ ok: true, data: {}, markdown: '' }),
  });

  registerToolset(
    defineToolset({
      id: 'stories',
      description: 'stub',
      telemetryGroup: 'dev',
      methods: {
        preview: stubMethod(() => {
          throw error;
        }),
        changed: stubMethod('changed'),
        findByComponent: stubMethod('find by component'),
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
  // Every gate claims support while the `stories` toolset never registered — the wiring bug this
  // containment exists for.
  const context = {
    availability: {
      changeDetectionEnabled: true,
      moduleGraphSupported: true,
      docsEnabled: true,
      a11yEnabled: false,
    },
  } as never;

  beforeEach(() => {
    clearToolsetRegistry();
    loggerError.mockClear();
  });

  it('is dropped from registration with an error log, keeping every other tool served', async () => {
    const { server, tools } = makeServer();

    await expect(registerAddonMcpTools(server, context)).resolves.toBeUndefined();

    expect([...tools.keys()]).toEqual(expect.not.arrayContaining(TOOLSET_BACKED));
    expect([...tools.keys()]).toEqual(
      expect.arrayContaining(['list-all-documentation', 'get-documentation'])
    );
    for (const name of TOOLSET_BACKED) {
      expect(loggerError).toHaveBeenCalledWith(expect.stringContaining(name));
    }
  });

  it('is dropped from the storybook ai metadata instead of failing the build', () => {
    const names = getAddonToolMetadata(context).map((tool) => tool.name);

    expect(names).toEqual(expect.not.arrayContaining(TOOLSET_BACKED));
    expect(names).toEqual(
      expect.arrayContaining(['get-storybook-story-instructions', 'list-all-documentation'])
    );
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('preview-stories'));
  });

  it('contains only the missing-toolset case: any other adapter failure still fails fast', () => {
    registerStoriesToolsetThrowing(new Error('broken description'));

    expect(() => getAddonToolMetadata(context)).toThrow('broken description');
  });
});

describe('the migrated rows over the registry', () => {
  const context = {
    availability: {
      changeDetectionEnabled: true,
      moduleGraphSupported: true,
      docsEnabled: false,
      a11yEnabled: false,
    },
  } as never;

  beforeEach(() => {
    clearToolsetRegistry();
  });

  // One integration probe through the real `stories` toolset: each row resolves off the registry
  // and publishes the frozen name and title an MCP client sees.
  it('serves every migrated row once its toolset is registered', async () => {
    registerCoreToolsetsForTest();
    const { server, tools } = makeServer();

    await registerAddonMcpTools(server, context);

    expect([...tools.keys()]).toEqual(expect.arrayContaining(TOOLSET_BACKED));
    expect(
      getAddonToolMetadata(context)
        .filter((tool) => TOOLSET_BACKED.includes(tool.name))
        .map((tool) => tool.title)
    ).toEqual([
      'Get story preview URLs',
      'Get changed stories metadata',
      'Get stories for component files',
    ]);
  });
});
