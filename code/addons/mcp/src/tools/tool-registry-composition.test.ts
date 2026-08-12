/**
 * Composition coverage for the docs tools, over a stubbed manifest provider.
 *
 * The e2e composition suites reach three live Chromatic-hosted Storybooks, so they cannot prove
 * anything when those are unreachable. These tests exercise the same registry path in-process.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectTelemetry } from '../telemetry.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata, registerAddonMcpTools } from './tool-registry.ts';

vi.mock('../telemetry.ts', { spy: true });

const SOURCES = [
  { id: 'local', title: 'Local' },
  { id: 'design-system', title: 'Design System', url: 'https://design.example.com' },
];

const COMPONENTS = JSON.stringify({
  v: 0,
  components: {
    button: { id: 'button', name: 'Button', stories: [{ name: 'Primary' }] },
  },
});

const availability = {
  docsEnabled: true,
  testSupported: false,
  a11yEnabled: false,
  docgenServer: false,
} as never;

/** Serves the components manifest for the named source, and fails for every other. */
function manifestProvider(readable: string[]) {
  return async (_request: unknown, path: string, source?: { id: string }) => {
    if (source && !readable.includes(source.id)) {
      throw new Error(`Failed to fetch manifest for ${source.id}`);
    }
    if (path.endsWith('components.json')) {
      return COMPONENTS;
    }
    throw new Error(`no manifest at ${path}`);
  };
}

function makeServer(readable: string[]) {
  const tools = new Map<string, (input: unknown) => Promise<any>>();
  const server = {
    ctx: {
      custom: {
        origin: 'http://localhost:6006',
        sources: SOURCES,
        manifestProvider: manifestProvider(readable),
      },
      sessionId: 'session-1',
    },
    tool: (metadata: { name: string }, handler: (input: unknown) => Promise<any>) => {
      tools.set(metadata.name, handler);
    },
    resource: () => {},
  } as any;

  return { server, tools };
}

const context = { availability, multiSource: true, toolsets: { docs: true } } as never;

describe('docs tools in a composition', () => {
  beforeEach(() => {
    registerCoreToolsetsForTest();
    vi.mocked(collectTelemetry).mockResolvedValue(undefined);
    vi.mocked(collectTelemetry).mockClear();
  });

  it('takes a storybookId, since ids are only unique within a source', () => {
    const metadata = getAddonToolMetadata(context);
    const show = metadata.find((tool) => tool.name === 'docs-show');

    expect((show?.schema as any).entries).toHaveProperty('storybookId');
  });

  it('groups the listing per source and reports the readable one', async () => {
    const { server, tools } = makeServer(['local', 'design-system']);
    await registerAddonMcpTools(server, context);

    const result = await tools.get('docs-list')!({});

    expect(result.content[0].text).toContain('# Local');
    expect(result.content[0].text).toContain('# Design System');
    expect(collectTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tool:listAllDocumentation',
        componentCount: 1,
        sourceCount: 2,
      })
    );
  });

  it('reports the first readable source when another one fails', async () => {
    const { server, tools } = makeServer(['design-system']);
    await registerAddonMcpTools(server, context);

    const result = await tools.get('docs-list')!({});

    expect(result.content[0].text).toContain('# Design System');
    expect(collectTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tool:listAllDocumentation', sourceCount: 2 })
    );
  });

  it('reports no usage when no source could be read', async () => {
    const { server, tools } = makeServer([]);
    await registerAddonMcpTools(server, context);

    const result = await tools.get('docs-list')!({});

    expect(result.isError).toBe(true);
    expect(collectTelemetry).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tool:listAllDocumentation' })
    );
  });

  it('asks which Storybook when a lookup names no source', async () => {
    const { server, tools } = makeServer(['local']);
    await registerAddonMcpTools(server, context);

    const result = await tools.get('docs-show')!({ id: 'button' });

    expect(result.content[0].text).toContain('storybookId is required');
    expect(result.isError).toBe(true);
  });
});
