import { resolveSkillInputs, type ToolAvailability } from 'storybook/internal/core-server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectTelemetry } from '../telemetry.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata, registerAddonMcpTools } from './tool-registry.ts';

vi.mock('../telemetry.ts', { spy: true });
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

beforeEach(() => {
  registerCoreToolsetsForTest();
  vi.mocked(collectTelemetry).mockResolvedValue(undefined);
  vi.mocked(resolveSkillInputs).mockResolvedValue({
    framework: '@storybook/react-vite',
    csfFactories: false,
    previewFile: '.storybook/preview.ts',
    typescript: true,
    ...availability,
  } as never);
});

// The toolsets are read per call, as `X-MCP-Toolsets` sets them per request.
async function serve(toolsets: { dev: boolean; docs: boolean; test: boolean }) {
  const tools = new Map<string, { metadata: any; handler: () => Promise<any> }>();
  const server = {
    ctx: { custom: { options: {}, toolsets, disableTelemetry: true }, sessionId: 'session-1' },
    tool: (metadata: any, handler: () => Promise<any>) => {
      tools.set(metadata.name, { metadata, handler });
    },
    resource: () => {},
  } as any;
  await registerAddonMcpTools(server, { availability });
  const call = async (name: string): Promise<string> =>
    (await tools.get(name)!.handler()).content[0].text;
  return { tools, call };
}

describe('ui-workflow', () => {
  it('returns the workflow with the tools of this server', async () => {
    const { call } = await serve({ dev: true, docs: true, test: true });
    const text = await call('ui-workflow');

    expect(text).toContain('The tools named here are tools of the Storybook MCP server.');
    expect(text).toContain('`docs-list`');
    expect(text).toContain('`test-run`');
    expect(text).toContain('Call `review-create` with:');
    expect(text).not.toContain('npx storybook tools');
  });

  it('leaves out the steps of the toolsets this request turns off', async () => {
    const { tools, call } = await serve({ dev: true, docs: false, test: false });
    const text = await call('ui-workflow');

    expect(text).not.toContain('`docs-list`');
    expect(text).not.toContain('`test-run`');
    expect(text).toContain('`review-create`');
    expect(tools.get('ui-workflow')!.metadata.description).not.toContain('runs the tests');
  });
});

describe('component-docs', () => {
  it('points to ui-workflow for a change to the UI, when the server has it', async () => {
    const withDev = await serve({ dev: true, docs: true, test: true });
    expect(await withDev.call('component-docs')).toContain(
      'For a change to the UI, call `ui-workflow`'
    );

    const withoutDev = await serve({ dev: false, docs: true, test: true });
    const text = await withoutDev.call('component-docs');
    expect(text).toContain('`docs-show` with an `id`');
    expect(text).not.toContain('ui-workflow');
  });
});

describe('skill tool metadata', () => {
  it('lists ui-workflow with the dev toolset and component-docs with the docs tools', () => {
    const names = (toolsets: { dev: boolean; docs: boolean; test: boolean }, docsEnabled = true) =>
      getAddonToolMetadata({ availability: { ...availability, docsEnabled }, toolsets }).map(
        (tool) => tool.name
      );

    expect(names({ dev: true, docs: true, test: true }).slice(0, 2)).toEqual([
      'ui-workflow',
      'component-docs',
    ]);
    expect(names({ dev: false, docs: true, test: true })).not.toContain('ui-workflow');
    expect(names({ dev: true, docs: true, test: true }, false)).not.toContain('component-docs');
  });
});
