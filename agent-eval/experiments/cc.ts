import type { ExperimentConfig } from '@vercel/agent-eval';
import { defaultExperimentConfig } from '../lib/experiment';

export default {
	...defaultExperimentConfig,
	agent: 'vercel-ai-gateway/claude-code',
} satisfies ExperimentConfig;
