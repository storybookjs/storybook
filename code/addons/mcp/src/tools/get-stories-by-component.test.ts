import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
  addGetStoriesByComponentTool,
  serializeComponentSection,
  type ComponentStoryMatch,
} from './get-stories-by-component.ts';
import type { AddonContext } from '../types.ts';
import * as getStoryIndexModule from '../utils/get-story-index.ts';
import * as componentStoriesModule from '../utils/resolve-component-stories.ts';
import type { ComponentStoriesResponse } from '../utils/resolve-component-stories.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import { GET_STORIES_BY_COMPONENT_TOOL_NAME } from './tool-names.ts';
import type { StoryIndex } from 'storybook/internal/types';

describe('getStoriesByComponentTool', () => {
  let server: McpServer<any, AddonContext>;
  const cwd = process.cwd();
  const testContext: AddonContext = {
    origin: 'http://localhost:6006',
    options: {} as AddonContext['options'],
    disableTelemetry: true,
  };

  function mockLookup(response: ComponentStoriesResponse) {
    vi.spyOn(componentStoriesModule, 'resolveComponentStories').mockResolvedValue(response);
  }

  beforeEach(async () => {
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for get-stories-by-component tool',
      },
      {
        adapter,
        capabilities: { tools: { listChanged: true } },
      }
    ).withContext<AddonContext>();

    await server.receive(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { sessionId: 'test-session' }
    );

    await addGetStoriesByComponentTool(server);
    vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(
      smallStoryIndexFixture as unknown as StoryIndex
    );
  });

  async function callTool(componentPaths: string[], maxDistance?: number) {
    return server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORIES_BY_COMPONENT_TOOL_NAME,
          arguments: { componentPaths, ...(maxDistance !== undefined ? { maxDistance } : {}) },
        },
      },
      { sessionId: 'test-session', custom: testContext }
    );
  }

  function getResult(response: unknown) {
    return (
      response as {
        result?: {
          content?: Array<{ text?: string }>;
          structuredContent?: unknown;
          isError?: boolean;
        };
      }
    ).result;
  }

  it('returns stories with their reverse-graph depth', async () => {
    mockLookup({
      available: true,
      results: [
        {
          componentPath: `${cwd}/src/Button.tsx`,
          matches: [
            { storyId: 'button--primary', depth: 1 },
            { storyId: 'button--secondary', depth: 1 },
          ],
        },
      ],
    });

    const response = await callTool([`${cwd}/src/Button.tsx`]);
    const result = getResult(response);

    expect(result?.content?.[0]?.text).toMatchInlineSnapshot(`
			"${cwd}/src/Button.tsx:
			→ 2 stories across 1 component, distances 1..1 (d1=2)
			distance 1:
			  - \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)
			  - \`button--secondary\`: Button / Secondary (\`./src/Button.stories.tsx\`)"
		`);
    expect(result?.structuredContent).toEqual({
      results: [
        {
          componentPath: `${cwd}/src/Button.tsx`,
          matches: [
            {
              storyId: 'button--primary',
              title: 'Button',
              name: 'Primary',
              importPath: './src/Button.stories.tsx',
              distance: 1,
            },
            {
              storyId: 'button--secondary',
              title: 'Button',
              name: 'Secondary',
              importPath: './src/Button.stories.tsx',
              distance: 1,
            },
          ],
        },
      ],
    });
  });

  it('reports components with no stories', async () => {
    mockLookup({
      available: true,
      results: [{ componentPath: `${cwd}/src/Missing.tsx`, matches: [] }],
    });

    const response = await callTool([`${cwd}/src/Missing.tsx`]);
    const result = getResult(response);

    expect(result?.content?.[0]?.text).toBe(`${cwd}/src/Missing.tsx: no stories found`);
  });

  it('handles multiple components in a single call', async () => {
    mockLookup({
      available: true,
      results: [
        {
          componentPath: `${cwd}/src/Input.tsx`,
          matches: [{ storyId: 'input--default', depth: 1 }],
        },
        { componentPath: `${cwd}/src/Missing.tsx`, matches: [] },
      ],
    });

    const response = await callTool([`${cwd}/src/Input.tsx`, `${cwd}/src/Missing.tsx`]);
    const text = getResult(response)?.content?.[0]?.text;

    expect(text).toContain('input--default');
    expect(text).toContain(`${cwd}/src/Missing.tsx: no stories found`);
  });

  it('rejects empty input', async () => {
    const response = await callTool([]);
    const result = getResult(response);
    expect(result?.isError).toBe(true);
  });

  it('surfaces a typed error when the dependency graph is unavailable', async () => {
    mockLookup({
      available: false,
      reason: "Storybook's story dependency graph is unavailable.",
    });

    const response = await callTool([`${cwd}/src/Button.tsx`]);
    const result = getResult(response);
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain('dependency graph is unavailable');
  });

  it('applies maxDistance and records clipped tail', async () => {
    mockLookup({
      available: true,
      results: [
        {
          componentPath: `${cwd}/src/Button.tsx`,
          matches: [
            { storyId: 'button--primary', depth: 1 },
            { storyId: 'button--secondary', depth: 1 },
            { storyId: 'input--default', depth: 3 },
          ],
        },
      ],
    });

    const response = await callTool([`${cwd}/src/Button.tsx`], 1);
    const text = getResult(response)?.content?.[0]?.text;
    expect(text).toContain('+1 more story at distance 3 hidden by `maxDistance: 1`');
  });
});

describe('serializeComponentSection', () => {
  const m = (
    storyId: string,
    title: string,
    distance: number,
    importPath = `./src/${title}.stories.tsx`
  ): ComponentStoryMatch => ({ storyId, title, name: storyId, importPath, distance });

  it('groups matches by distance and prefixes a shape summary', () => {
    const text = serializeComponentSection('/repo/src/Button.tsx', [
      m('button--primary', 'Button', 0, './src/Button.stories.tsx'),
      m('modal--default', 'Modal', 1, './src/Modal.stories.tsx'),
      m('page--default', 'Page', 2, './src/Page.stories.tsx'),
    ]);
    expect(text).toMatchInlineSnapshot(`
			"/repo/src/Button.tsx:
			→ 3 stories across 3 components, distances 0..2 (d0=1, d1=1, d2=1)
			distance 0:
			  - \`button--primary\`: Button / button--primary (\`./src/Button.stories.tsx\`)
			distance 1:
			  - \`modal--default\`: Modal / modal--default (\`./src/Modal.stories.tsx\`)
			distance 2:
			  - \`page--default\`: Page / page--default (\`./src/Page.stories.tsx\`)"
		`);
  });

  it('reports no stories found when matches are empty', () => {
    expect(serializeComponentSection('/repo/src/Missing.tsx', [])).toBe(
      '/repo/src/Missing.tsx: no stories found'
    );
  });

  it('singularizes the summary when there is exactly one match in one component', () => {
    const text = serializeComponentSection('/repo/src/Button.tsx', [
      m('button--primary', 'Button', 0),
    ]);
    expect(text).toContain('→ 1 story across 1 component, distances 0..0 (d0=1)');
  });

  it('distinguishes "no stories within maxDistance" from "no stories found"', () => {
    const text = serializeComponentSection('/repo/src/lib/apolloCacheUtils.ts', [], {
      maxDistance: 2,
      clipped: { count: 1212, distances: [3, 4] },
    });
    expect(text).toBe(
      '/repo/src/lib/apolloCacheUtils.ts: no stories within `maxDistance: 2` — +1212 more stories at distances 3..4 hidden by `maxDistance: 2`.'
    );
  });

  it('appends a clipped-tail line when some matches passed the cap and others did not', () => {
    const text = serializeComponentSection(
      '/repo/src/Button.tsx',
      [m('button--primary', 'Button', 0), m('modal--default', 'Modal', 1)],
      { maxDistance: 1, clipped: { count: 42, distances: [2, 3, 4] } }
    );
    expect(text).toContain('+42 more stories at distances 2..4 hidden by `maxDistance: 1`');
  });

  it('emits singular phrasing when exactly one match was clipped', () => {
    const text = serializeComponentSection('/repo/src/Lib.ts', [m('a--default', 'A', 0)], {
      maxDistance: 1,
      clipped: { count: 1, distances: [2] },
    });
    expect(text).toContain('+1 more story at distance 2 hidden by `maxDistance: 1`');
  });

  it('does not emit the clipped tail when nothing was clipped', () => {
    const text = serializeComponentSection(
      '/repo/src/Button.tsx',
      [m('button--primary', 'Button', 0)],
      { maxDistance: 2 }
    );
    expect(text).not.toContain('hidden by');
  });
});
