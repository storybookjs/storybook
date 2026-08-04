import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';
import { mcpRequest, waitForMcpEndpoint, killPort, startStorybook, stopStorybook } from './helpers';

/**
 * The addon-vitest installed-but-not-enabled scenario (a hoisted monorepo dependency, or an addon
 * removed from `main.ts` without uninstalling): its `services` hook never runs, so the `test`
 * toolset never registers. The availability gate must agree — the endpoint serves everything
 * except `run-story-tests`, instead of failing every request because one tool's toolset is
 * missing.
 */

const PORT = 6010;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;
const STARTUP_TIMEOUT = 60_000;

let storybookProcess: ReturnType<typeof x> | null = null;

describe('MCP endpoint with addon-vitest installed but not enabled', () => {
	beforeAll(async () => {
		await killPort(PORT);
		storybookProcess = startStorybook('.storybook-no-vitest', PORT);
		await waitForMcpEndpoint(MCP_ENDPOINT);
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		await stopStorybook(storybookProcess);
		storybookProcess = null;
	});

	it('serves every tool except run-story-tests', async () => {
		const response = await mcpRequest(MCP_ENDPOINT, 'tools/list');

		const names = response.result.tools.map((tool: { name: string }) => tool.name).sort();
		expect(names).toEqual([
			'display-review',
			'get-changed-stories',
			'get-documentation',
			'get-documentation-for-story',
			'get-stories-by-component',
			'get-storybook-story-instructions',
			'list-all-documentation',
			'preview-stories',
		]);
	});

	it('still answers tool calls', async () => {
		const response = await mcpRequest(MCP_ENDPOINT, 'tools/call', {
			name: 'get-storybook-story-instructions',
			arguments: {},
		});

		expect(response.result.isError).toBeUndefined();
		expect(response.result.content[0].text).toContain('Storybook');
	});
});
