import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
	agent: 'vercel-ai-gateway/claude-code',
	runs: 1,
	earlyExit: true,
	scripts: ['build'],
	timeout: 600,
	sandbox: 'docker',
};

export default config;
