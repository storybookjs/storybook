import type { ExperimentConfig, Sandbox } from '@vercel/agent-eval';
import { CLAUDE_PLUGIN_EVALS, DEFAULT_EXPERIMENT_CONFIG } from '../lib/experiment.ts';
import {
	setupSandbox,
	writeClaudePluginSkills,
	writeClaudePreviewBrowserMock,
} from '../lib/templates.ts';

const PREVIEW_BROWSER_MOCK_EVALS = new Set(['922-skill-storybook-setup-claude-launch']);

export default {
	...DEFAULT_EXPERIMENT_CONFIG,
	agent: 'vercel-ai-gateway/claude-code',
	evals: [...CLAUDE_PLUGIN_EVALS],
	setup: async (sandbox) => {
		await setupSandbox(sandbox, { agent: 'claude-code', integration: 'plugin' });
		await writeClaudePluginSkills(sandbox);
		if (await usesPreviewBrowserMock(sandbox)) {
			await writeClaudePreviewBrowserMock(sandbox);
		}
	},
} satisfies ExperimentConfig;

async function usesPreviewBrowserMock(sandbox: Sandbox): Promise<boolean> {
	const packageJson = JSON.parse(await sandbox.readFile('package.json')) as unknown;

	return (
		isRecord(packageJson) &&
		typeof packageJson.name === 'string' &&
		PREVIEW_BROWSER_MOCK_EVALS.has(packageJson.name)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
