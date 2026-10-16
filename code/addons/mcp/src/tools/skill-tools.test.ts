import { resolveSkillInputs, type ToolAvailability } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { clearToolsetRegistry, registerToolset } from 'storybook/open-service';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestToolset } from '../../../vitest/src/node/toolset/definition.ts';
import { collectTelemetry } from '../telemetry.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata, registerAddonMcpTools } from './tool-registry.ts';

vi.mock('../telemetry.ts', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/core-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/core-server')>()),
  resolveSkillInputs: vi.fn(),
}));

const availability: ToolAvailability = {
  moduleGraphSupported: true,
  docsEnabled: true,
  docsEnabledForCli: true,
  docsHasManifests: true,
  docsFeatureEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  docgenServer: true,
};

type Toolsets = { dev: boolean; docs: boolean; test: boolean };
const ALL: Toolsets = { dev: true, docs: true, test: true };

function registerTestToolset() {
  registerToolset(
    createTestToolset({
      channel: { on: () => {}, off: () => {}, emit: () => {} },
      storyIndex: { getIndex: async () => ({ v: 5, entries: {} }) },
      a11yEnabled: true,
    })
  );
}

beforeEach(() => {
  clearToolsetRegistry();
  registerCoreToolsetsForTest();
  vi.mocked(collectTelemetry).mockResolvedValue(undefined);
  vi.mocked(logger.error).mockImplementation(() => {});
  vi.mocked(resolveSkillInputs).mockResolvedValue({
    framework: '@storybook/react-vite',
    csfFactories: false,
    previewFile: '.storybook/preview.ts',
    typescript: true,
    ...availability,
  } as never);
});

// One registered server; `request` sets the toolsets of the next call, as `X-MCP-Toolsets` does.
async function serve() {
  const tools = new Map<string, { metadata: any; handler: () => Promise<any> }>();
  const custom: { options: object; toolsets: Toolsets; disableTelemetry: boolean } = {
    options: {},
    toolsets: ALL,
    disableTelemetry: true,
  };
  const server = {
    ctx: { custom, sessionId: 'session-1' },
    tool: (metadata: any, handler: () => Promise<any>) => {
      tools.set(metadata.name, { metadata, handler });
    },
    resource: () => {},
  } as any;
  await registerAddonMcpTools(server, { availability });
  const request = (toolsets: Toolsets) => {
    custom.toolsets = toolsets;
    return {
      names: [...tools.keys()],
      description: (name: string): string => tools.get(name)!.metadata.description,
      call: async (name: string): Promise<string> =>
        (await tools.get(name)!.handler()).content[0].text,
    };
  };
  return { request };
}

describe('ui-workflow', () => {
  it('returns the workflow with the tools of this server', async () => {
    registerTestToolset();
    const { request } = await serve();
    const text = await request(ALL).call('ui-workflow');

    expect(text).toContain('The tools named here are tools of the Storybook MCP server.');
    expect(text).toContain('`docs-list`');
    expect(text).toContain('Call `test-run`');
    expect(text).toContain('Call `review-create` with:');
    expect(text).not.toContain('npx storybook tools');
  });

  it('leaves out the steps of the toolsets each request turns off', async () => {
    registerTestToolset();
    const { request } = await serve();

    const all = request(ALL);
    expect(await all.call('ui-workflow')).toContain('Call `test-run`');
    expect(all.description('ui-workflow')).toContain('runs the tests');

    const devOnly = request({ dev: true, docs: false, test: false });
    const text = await devOnly.call('ui-workflow');
    expect(text).not.toContain('`docs-list`');
    expect(text).not.toContain('`test-run`');
    expect(text).not.toContain('always look up the components first');
    expect(text).toContain('`review-create`');
    expect(devOnly.description('ui-workflow')).not.toContain('runs the tests');
  });

  it('does not name a tool whose toolset failed to register', async () => {
    // `availability` says tests are supported, but no test toolset is registered.
    const { request } = await serve();
    const all = request(ALL);

    expect(all.names).not.toContain('test-run');
    expect(await all.call('ui-workflow')).not.toContain('`test-run`');
    expect(all.description('ui-workflow')).not.toContain('runs the tests');
  });
});

describe('component-docs', () => {
  it('points to ui-workflow for a change to the UI, when the server has it', async () => {
    registerTestToolset();
    const { request } = await serve();

    expect(await request(ALL).call('component-docs')).toContain(
      'For a change to the UI, call `ui-workflow`: it includes this lookup, then writes the stories, runs the tests and publishes the review.'
    );
    expect(await request({ dev: true, docs: true, test: false }).call('component-docs')).toContain(
      'then writes the stories and publishes the review.'
    );

    const withoutDev = await request({ dev: false, docs: true, test: true }).call('component-docs');
    expect(withoutDev).toContain('`docs-show` with an `id`');
    expect(withoutDev).not.toContain('ui-workflow');
  });
});

describe('skill tool metadata', () => {
  it('lists ui-workflow with the dev toolset and component-docs with the docs tools', () => {
    const names = (toolsets: Toolsets, docsEnabled = true) =>
      getAddonToolMetadata({ availability: { ...availability, docsEnabled }, toolsets }).map(
        (tool) => tool.name
      );

    expect(names(ALL).slice(0, 2)).toEqual(['ui-workflow', 'component-docs']);
    expect(names({ dev: false, docs: true, test: true })).not.toContain('ui-workflow');
    expect(names(ALL, false)).not.toContain('component-docs');
  });
});
