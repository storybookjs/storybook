import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';
import {
	createMCPRequestBody,
	parseMCPResponse,
	waitForMcpEndpoint,
	killPort,
	startStorybook,
	stopStorybook,
} from './helpers';

const PORT = 6009;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;
const STARTUP_TIMEOUT = 60_000;

let storybookProcess: ReturnType<typeof x> | null = null;

async function mcpRequest(method: string, params: any = {}) {
	const response = await fetch(MCP_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(createMCPRequestBody(method, params)),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return parseMCPResponse(response);
}

describe('MCP Composition + Docgen Server E2E Tests', () => {
	beforeAll(async () => {
		await killPort(PORT);
		storybookProcess = startStorybook('.storybook-composition-docgen-server', PORT);
		await waitForMcpEndpoint(MCP_ENDPOINT);
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		await stopStorybook(storybookProcess);
		storybookProcess = null;
	});

	describe('Multi-Source Documentation', () => {
		it('should list documentation from both local (docgen server) and remote (v0) sources', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const text = response.result.content[0].text;

			expect(text).toContain('# Local');
			expect(text).toContain('id: local');
			expect(text).toContain('# Storybook UI');
			expect(text).toContain('id: storybook-ui');
			expect(text).toContain('Button (example-button)');
			expect(text).toContain('## Components');
		});

		it('should fetch documentation for a local component via in-process docgen server', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
					storybookId: 'local',
				},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0].type).toBe('text');

			const text = response.result.content[0].text;
			expect(text).toContain('# Button');
			expect(text).toContain('ID: example-button');
			expect(text).toContain('## Stories');
			expect(text).toContain('example-button--primary');
			expect(text).toContain('## Props');
			expect(text).toContain('label: string');
			expect(text).toContain('## Docs');
		});

		it('should fetch documentation for a component from remote v0 source', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
					storybookId: 'storybook-ui',
				},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0].type).toBe('text');

			const text = response.result.content[0].text;
			expect(text).toContain('Button');
			expect(text).toContain('example-button');
		});

		it('should silently exclude refs that have no manifest', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const text = response.result.content[0].text;

			expect(text).not.toContain('No Manifest');
			expect(text).not.toContain('no-manifest');
		});

		it('should require storybookId in multi-source mode', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
				},
			});

			expect(response.result.isError).toBe(true);
			expect(response.result.content[0].text).toContain('storybookId');
		});
	});

	describe('Docgen Server Local Manifests', () => {
		it('should not serve local components.json over HTTP in docgen-server dev mode', async () => {
			const response = await fetch(`http://localhost:${PORT}/manifests/components.json`);
			expect(response.status).toBe(404);
		});

		it('should still resolve local docs through MCP despite HTTP 404', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'getting-started--docs',
					storybookId: 'local',
				},
			});

			expect(response.result.isError).toBeFalsy();
			const text = response.result.content[0].text;
			expect(text).toContain('Getting Started');
		});
	});

	describe('Public Refs (No Auth)', () => {
		it('should not require authentication for public refs', async () => {
			const response = await fetch(`http://localhost:${PORT}/.well-known/oauth-protected-resource`);
			const text = await response.text();

			expect(text).toBe('Not found');
		});
	});

	describe('Tools Schema', () => {
		it('should include storybookId parameter in get-documentation schema', async () => {
			const response = await mcpRequest('tools/list');

			const getDocTool = response.result.tools.find((t: any) => t.name === 'get-documentation');

			expect(getDocTool).toBeDefined();
			expect(getDocTool.inputSchema.properties).toHaveProperty('storybookId');
		});
	});
});
