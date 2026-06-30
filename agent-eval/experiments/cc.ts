import type { ExperimentConfig } from '@vercel/agent-eval';
import { defaultExperimentConfig } from '../lib/experiment.ts';

export default {
	...defaultExperimentConfig,
	agent: 'vercel-ai-gateway/claude-code',
} satisfies ExperimentConfig;
