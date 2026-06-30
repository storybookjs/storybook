import { type ExperimentConfig } from '@vercel/agent-eval';

export const defaultExperimentConfig: Partial<ExperimentConfig> = {
	runs: 3,
	earlyExit: false,
	sandbox: 'vercel',
	copyFiles: 'all',
	scripts: ['build'],
};
