import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));

const skillNames = ['storybook-init', 'storybook-mcp-setup', 'storybook-upgrade'];

async function readJson<T>(relativePath: string) {
	const contents = await readFile(resolve(packageRoot, relativePath), 'utf8');
	return JSON.parse(contents) as T;
}

async function sendInitialize(child: ChildProcess, stdoutData: string[]) {
	child.stdin?.write(
		`${JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: { name: 'plugin-test', version: '1.0.0' },
			},
		})}\n`,
	);

	await new Promise<void>((resolvePromise, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Timeout waiting for MCP initialize response'));
		}, 30_000);

		const checkResponse = () => {
			const responseLine = stdoutData
				.join('')
				.split('\n')
				.find((line) => {
					try {
						return JSON.parse(line).id === 1;
					} catch {
						return false;
					}
				});

			if (responseLine) {
				clearTimeout(timeout);
				resolvePromise();
				return;
			}

			setTimeout(checkResponse, 50);
		};

		checkResponse();
	});
}

describe('Storybook Codex plugin package', () => {
	it('ships the marketplace, plugin manifest, skills, and MCP config', () => {
		expect(existsSync(resolve(packageRoot, '.agents/plugins/marketplace.json'))).toBe(true);
		expect(existsSync(resolve(packageRoot, '.codex-plugin/plugin.json'))).toBe(true);
		expect(existsSync(resolve(packageRoot, '.mcp.json'))).toBe(true);
		expect(existsSync(resolve(packageRoot, 'assets/storybook.svg'))).toBe(true);

		for (const skillName of skillNames) {
			expect(existsSync(resolve(packageRoot, 'skills', skillName, 'SKILL.md'))).toBe(true);
		}
	});

	it('registers this package as the local marketplace source', async () => {
		const marketplace = await readJson<{
			plugins: Array<{ name: string; source: { path: string } }>;
		}>('.agents/plugins/marketplace.json');

		expect(marketplace.plugins).toEqual([
			expect.objectContaining({
				name: 'storybook',
				source: {
					source: 'local',
					path: '.',
				},
			}),
		]);
	});

	it('configures MCP launch args for pkg.pr.new previews', async () => {
		const mcpConfig = await readJson<{
			storybook: { command: string; args: string[] };
		}>('.mcp.json');

		expect(mcpConfig.storybook).toEqual({
			command: 'npx',
			args: ['-y', 'https://pkg.pr.new/storybookjs/mcp/@storybook/mcp-proxy@227'],
		});
	});

	it('smoke-tests the configured MCP server command', async () => {
		const mcpConfig = await readJson<{
			storybook: { command: string; args: string[] };
		}>('.mcp.json');
		const { command, args } = mcpConfig.storybook;
		const stdoutData: string[] = [];
		const proc = x(command, args);
		const child = proc.process as ChildProcess;

		child.stdout?.on('data', (chunk) => stdoutData.push(chunk.toString()));

		try {
			await sendInitialize(child, stdoutData);
		} finally {
			child.kill();
		}

		const responseLine = stdoutData
			.join('')
			.split('\n')
			.find((line) => {
				try {
					return JSON.parse(line).id === 1;
				} catch {
					return false;
				}
			});

		expect(JSON.parse(responseLine!)).toMatchObject({
			result: {
				serverInfo: {
					name: '@storybook/mcp-proxy',
				},
			},
		});
	}, 60_000);
});
