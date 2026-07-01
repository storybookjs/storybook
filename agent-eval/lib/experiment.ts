import type { ExperimentConfig } from '@vercel/agent-eval';

export const RESHAPED_COMPONENT_EVALS = [
	'901-create-component-atom-reshaped-concise',
	'901-create-component-atom-reshaped-detailed',
	'901-create-component-atom-reshaped-explicit-stories',
] as const;

export const CLAUDE_PLUGIN_EVALS = [
	...RESHAPED_COMPONENT_EVALS,
	'922-skill-storybook-setup-claude-launch',
] as const;

export const defaultExperimentConfig = {
	runs: 1,
	earlyExit: true,
	sandbox: 'auto',
	copyFiles: 'all',
	scripts: ['build'],
} satisfies Partial<ExperimentConfig>;
