import type { ExperimentConfig } from '@vercel/agent-eval';

const ALL_RESHAPED_STORYBOOK_EVALS = [
	'901-create-component-atom-reshaped-concise',
	'901-create-component-atom-reshaped-detailed',
	'901-create-component-atom-reshaped-explicit-stories',
	'902-create-component-composite-reshaped-concise',
	'902-create-component-composite-reshaped-detailed',
	'902-create-component-composite-reshaped-explicit-stories',
	'903-create-component-async-fetch-reshaped-concise',
	'903-create-component-async-fetch-reshaped-detailed',
	'903-create-component-async-fetch-reshaped-explicit-stories',
	'904-create-component-async-module-reshaped-concise',
	'904-create-component-async-module-reshaped-detailed',
	'904-create-component-async-module-reshaped-explicit-stories',
	'905-existing-component-write-story-reshaped-concise',
	'905-existing-component-write-story-reshaped-detailed',
	'906-existing-component-edit-story-reshaped-concise',
	'906-existing-component-edit-story-reshaped-detailed',
	'907-existing-component-change-component-reshaped-concise',
	'907-existing-component-change-component-reshaped-detailed',
	'907-existing-component-change-component-reshaped-explicit-stories',
	'908-run-story-tests',
	'909-run-tests-after-component-creation',
	'910-run-tests-without-a11y-concise',
	'910-run-tests-without-a11y-explicit',
	'911-fix-failing-tests',
	'911-fix-failing-tests-vitest-cli',
	'912-fix-a11y-violations',
	'912-fix-a11y-violations-explicit',
	'913-run-all-tests-final-verification',
	'914-preview-story-by-path',
	'915-preview-story-by-id',
	'915-preview-story-by-id-docs-first',
] as const;

// Deliberately starting with a single eval to keep sandbox/token costs low
// while we stabilize CI; we will work our way up to the full
// ALL_RESHAPED_STORYBOOK_EVALS list. See storybookjs/mcp#315.
export const RESHAPED_STORYBOOK_EVALS = [
	'901-create-component-atom-reshaped-concise',
	// '908-run-story-tests',
	// '912-fix-a11y-violations',
	// '914-preview-story-by-path',
	// '915-preview-story-by-id',
] satisfies (typeof ALL_RESHAPED_STORYBOOK_EVALS)[number][];

// Non-default model tiers (e.g. cc-plugin-sonnet-medium) run zero evals unless
// explicitly enabled, so labeled CI runs only pay for the default-model
// experiments. Enable with EVAL_EXTRA_MODELS=1 (locally or via the
// workflow_dispatch input in CI).
export const EXTRA_MODEL_EVALS: (typeof ALL_RESHAPED_STORYBOOK_EVALS)[number][] = process.env
	.EVAL_EXTRA_MODELS
	? [...RESHAPED_STORYBOOK_EVALS]
	: [];

export const DEFAULT_EXPERIMENT_CONFIG = {
	// Keep runs at 1: the runner starts all attempts in parallel (earlyExit only
	// aborts in-flight runs), so runs > 1 spins up extra sandboxes even on a pass.
	runs: 1,
	earlyExit: true,
	sandbox: 'auto',
	copyFiles: 'all',
	// Disabling the scripts for now, as this is flaky, and not often OUR fault
	// scripts: ['typecheck', 'build', 'test:stories', 'lint'],
} satisfies Partial<ExperimentConfig>;
