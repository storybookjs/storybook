import type { ExperimentConfig, RunCompleteContext } from '@vercel/agent-eval';
import { collectTranscriptUsage } from './usage.ts';

// The 8xx line: hand-crafted evals written for the current plugin/MCP
// workflow (story instructions, display-review, launch config, preview
// browser), covering the behavior branches from the "Agentic Review Eval
// instructions" spec. This is the set that always runs on CI.
const CORE_STORYBOOK_EVALS = [
	// New component; the fixture empties the template's .claude/launch.json
	// configurations, so the plugin must set up the Storybook entry itself
	'801-create-component-no-launch-config',
	// New component with the template's valid launch config left intact
	'802-create-component',
	// Edit a component that already has stories; review covers the change
	'803-edit-component',
	// Add stories for the uncovered component in a multi-component project
	'804-write-story-for-existing-component',
	// Pure rename, no behavior change: display-review must NOT be called
	'805-non-visual-refactor',
	// "Show me all X states": review published without changedFiles
	'806-browse-request',
	// "What props does X accept": answered via the documentation tools
	'807-docs-request',
] as const;

// The 9xx line: evals ported from the old eval system (/eval), written for
// the MCP-only workflow. On default (`next`) CI runs they are too expensive
// and currently too flaky, so they only run under EVAL_STORYBOOK_LATEST=1
// (or manually via EVAL_ONLY). See storybookjs/mcp#315.
const PORTED_RESHAPED_STORYBOOK_EVALS = [
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

type EvalName =
	| (typeof CORE_STORYBOOK_EVALS)[number]
	| (typeof PORTED_RESHAPED_STORYBOOK_EVALS)[number];

// EVAL_STORYBOOK_LATEST=1 (the ci:storybook-latest PR label or the
// workflow_dispatch input in CI) runs the local MCP server against the stable
// Storybook release instead of `next`. The 8xx line and the plugin skills
// target the current plugin/MCP workflow and are not compatible with the
// stable release, so latest runs switch to the ported 9xx line and skip the
// plugin experiments (see PLUGIN_STORYBOOK_EVALS below).
const STORYBOOK_LATEST = process.env.EVAL_STORYBOOK_LATEST === '1';

// By default only the first eval of the active line runs, to keep
// sandbox/token costs low. Set EVAL_EXTRA_EVALS=1 (the ci:extra-evals PR label
// or the workflow_dispatch input in CI) to run the full line.
// EVAL_ONLY=<name>[,<name>] narrows the set to specific evals (core 8xx or
// ported 9xx) for local debugging, one eval at a time.
function resolveActiveEvals(): EvalName[] {
	const only = process.env.EVAL_ONLY;
	if (only !== undefined && only !== '') {
		const knownEvals = [...CORE_STORYBOOK_EVALS, ...PORTED_RESHAPED_STORYBOOK_EVALS];
		return only.split(',').map((name) => {
			const match = knownEvals.find((evalName) => evalName === name.trim());
			if (match === undefined) {
				throw new Error(
					`Unknown EVAL_ONLY entry "${name.trim()}". Valid evals: ${knownEvals.join(', ')}`,
				);
			}
			return match;
		});
	}

	if (process.env.EVAL_EXTRA_EVALS === '1') {
		return STORYBOOK_LATEST ? [...PORTED_RESHAPED_STORYBOOK_EVALS] : [...CORE_STORYBOOK_EVALS];
	}

	return STORYBOOK_LATEST
		? ['901-create-component-atom-reshaped-concise']
		: ['801-create-component-no-launch-config'];
}

export const RESHAPED_STORYBOOK_EVALS: EvalName[] = resolveActiveEvals();

// Plugin-integration experiments run zero evals under EVAL_STORYBOOK_LATEST=1:
// the plugin skills are not compatible with the stable Storybook release, so
// only the MCP experiments exercise the 9xx line there.
export const PLUGIN_STORYBOOK_EVALS: EvalName[] = STORYBOOK_LATEST ? [] : RESHAPED_STORYBOOK_EVALS;

// Non-default model tiers (e.g. cc-plugin-sonnet-medium) run zero evals unless
// explicitly enabled, so labeled CI runs only pay for the default-model
// experiments. Enable with EVAL_EXTRA_MODELS=1 (locally or via the
// workflow_dispatch input in CI).
export const EXTRA_MODEL_EVALS: EvalName[] =
	process.env.EVAL_EXTRA_MODELS === '1' ? [...RESHAPED_STORYBOOK_EVALS] : [];

export const EXTRA_MODEL_PLUGIN_EVALS: EvalName[] =
	process.env.EVAL_EXTRA_MODELS === '1' ? [...PLUGIN_STORYBOOK_EVALS] : [];

function attachUsageMetadata({ runData }: RunCompleteContext) {
	if (!runData.transcript) {
		return;
	}

	const usage = collectTranscriptUsage(runData.transcript, runData.result.observedModel);

	if (!usage) {
		return;
	}

	return {
		...runData,
		result: {
			...runData.result,
			metadata: { ...runData.result.metadata, usage },
		},
	};
}

export const DEFAULT_EXPERIMENT_CONFIG = {
	onRunComplete: attachUsageMetadata,
	// Keep runs at 1: the runner starts all attempts in parallel (earlyExit only
	// aborts in-flight runs), so runs > 1 spins up extra sandboxes even on a pass.
	runs: 1,
	earlyExit: true,
	sandbox: 'auto',
	copyFiles: 'all',
	// Disabling the scripts for now, as this is flaky, and not often OUR fault
	// scripts: ['typecheck', 'build', 'test:stories', 'lint'],
} satisfies Partial<ExperimentConfig>;
