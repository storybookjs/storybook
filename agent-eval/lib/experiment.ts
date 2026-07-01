import type { ExperimentConfig } from '@vercel/agent-eval';

export const defaultExperimentConfig = {
	runs: 1,
	earlyExit: true,
	sandbox: 'auto',
	copyFiles: 'all',
	scripts: ['build'],
} satisfies Partial<ExperimentConfig>;
