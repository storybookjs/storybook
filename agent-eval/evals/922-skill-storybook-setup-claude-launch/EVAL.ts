import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

type LaunchConfig = { name?: string; command?: string; autoPort?: boolean };

function launchConfigs(): LaunchConfig[] {
	const raw = JSON.parse(readFileSync('.claude/launch.json', 'utf8')) as Record<string, unknown>;
	const list = Array.isArray(raw)
		? raw
		: (raw.configurations ?? raw.launches ?? raw.entries ?? raw.launch);

	return Array.isArray(list) ? (list as LaunchConfig[]) : [];
}

test('adds a Storybook launch entry with autoPort: true', () => {
	const storybook = launchConfigs().find((config) => config.name === 'Storybook');

	expect(storybook, '.claude/launch.json must contain a "Storybook" entry').toBeDefined();
	expect(storybook?.autoPort).toBe(true);
});

test('preserves the existing App dev server launch entry', () => {
	const appDevServer = launchConfigs().find((config) => config.name === 'App dev server');

	expect(appDevServer, '.claude/launch.json must keep the "App dev server" entry').toBeDefined();
	expect(appDevServer?.command).toBe('pnpm dev');
	expect(appDevServer?.autoPort).toBe(true);
});
