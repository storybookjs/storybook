import type { ExperimentConfig, RunCompleteContext } from '@vercel/agent-eval';
import { collectTranscriptUsage } from './usage.ts';

// The 8xx line: hand-crafted evals for the current plugin/MCP workflow,
// one per workflow behavior branch. This is the set that always runs on CI.
const CORE_STORYBOOK_EVALS = [
	'801-create-component-no-launch-config',
	'802-create-component',
	'803-edit-component',
	'804-write-story-for-existing-component',
	'805-non-visual-refactor',
	'806-browse-request',
	'807-docs-request',
	'808-shared-infra-fallback',
	'810-fix-failing-tests',
	'811-fix-a11y-violations',
	'812-first-story-empty-project',
	'813-monorepo-leaf-create-component',
] as const;

// The 82x block: lifecycle-skill evals (storybook-init / storybook-upgrade).
// They only run on the plugin experiments — the MCP experiments require a
// Storybook already running at :6006/mcp, which these fixtures don't have.
const LIFECYCLE_STORYBOOK_EVALS = [
	'820-init-no-storybook',
	'821-upgrade-from-sb9',
	'822-upgrade-from-stable',
	'823-setup-outdated-storybook',
] as const;

// The 9xx line: ports from the old /eval system, written for the MCP-only
// workflow of the published stable release. They only run under
// EVAL_STORYBOOK_LATEST=1 (or via EVAL_ONLY).
const PORTED_WORKFLOW_STORYBOOK_EVALS = [
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
	| (typeof LIFECYCLE_STORYBOOK_EVALS)[number]
	| (typeof PORTED_WORKFLOW_STORYBOOK_EVALS)[number];

// EVAL_STORYBOOK_LATEST=1 pins the sandbox Storybook to the stable release
// instead of `next`. The 8xx line and the plugin skills target the current
// workflow and are not compatible with the stable release, so latest runs
// switch to the ported 9xx line and skip the plugin experiments.
const STORYBOOK_LATEST = process.env.EVAL_STORYBOOK_LATEST === '1';

// By default only the first eval of the active line runs, to keep costs low.
// EVAL_EXTRA_EVALS=1 runs the full line; EVAL_ONLY=<name>[,<name>] narrows
// the set to specific evals for local debugging.
function resolveActiveEvals(): { core: EvalName[]; lifecycle: EvalName[] } {
	const only = process.env.EVAL_ONLY;
	if (only !== undefined && only !== '') {
		const knownEvals = [
			...CORE_STORYBOOK_EVALS,
			...LIFECYCLE_STORYBOOK_EVALS,
			...PORTED_WORKFLOW_STORYBOOK_EVALS,
		];
		const selected = only.split(',').map((name) => {
			const match = knownEvals.find((evalName) => evalName === name.trim());
			if (match === undefined) {
				throw new Error(
					`Unknown EVAL_ONLY entry "${name.trim()}". Valid evals: ${knownEvals.join(', ')}`,
				);
			}
			return match;
		});
		const partitioned = {
			core: selected.filter(
				(name) => !(LIFECYCLE_STORYBOOK_EVALS as readonly string[]).includes(name),
			),
			lifecycle: selected.filter((name) =>
				(LIFECYCLE_STORYBOOK_EVALS as readonly string[]).includes(name),
			),
		};
		if (partitioned.core.length === 0 && partitioned.lifecycle.length > 0) {
			console.warn(
				'EVAL_ONLY selected only lifecycle (82x) evals; the MCP experiments will run zero evals.',
			);
		}
		return partitioned;
	}

	if (process.env.EVAL_EXTRA_EVALS === '1') {
		return STORYBOOK_LATEST
			? { core: [...PORTED_WORKFLOW_STORYBOOK_EVALS], lifecycle: [] }
			: { core: [...CORE_STORYBOOK_EVALS], lifecycle: [...LIFECYCLE_STORYBOOK_EVALS] };
	}

	return STORYBOOK_LATEST
		? { core: ['901-create-component-atom-reshaped-concise'], lifecycle: [] }
		: { core: ['801-create-component-no-launch-config'], lifecycle: [] };
}

const ACTIVE_EVALS = resolveActiveEvals();

// Evals for the MCP experiments: the active line without the lifecycle 82x
// evals (those need a Storybook the agent has not set up yet).
export const WORKFLOW_STORYBOOK_EVALS: EvalName[] = ACTIVE_EVALS.core;

// Plugin experiments additionally run the lifecycle 82x evals. Under
// EVAL_STORYBOOK_LATEST=1 they run nothing: the plugin skills target the
// current workflow, not the stable release.
export const PLUGIN_STORYBOOK_EVALS: EvalName[] = STORYBOOK_LATEST
	? []
	: [...ACTIVE_EVALS.core, ...ACTIVE_EVALS.lifecycle];

// Non-default model tiers run zero evals unless EVAL_EXTRA_MODELS=1, so
// labeled CI runs only pay for the default-model experiments.
export const EXTRA_MODEL_EVALS: EvalName[] =
	process.env.EVAL_EXTRA_MODELS === '1' ? [...WORKFLOW_STORYBOOK_EVALS] : [];

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
	// The runner default of 600s is too tight for opus-high on the plugin
	// path: passing runs have taken up to 458s (2026-07-03 CI runs).
	timeout: 900,
	sandbox: 'auto',
	copyFiles: 'all',
	// Post-run script checks stay disabled: they fail on sandbox environment
	// flakiness (installs, ports) more often than on agent mistakes, and the
	// EVAL.ts assertions already cover the outcomes that matter.
	// scripts: ['typecheck', 'build', 'test:stories', 'lint'],
} satisfies Partial<ExperimentConfig>;
