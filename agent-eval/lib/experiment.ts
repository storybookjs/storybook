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
	// Shared token change: review via the get-stories-by-component fallback,
	// surfacing the consumer stories (spec §7 archetype 2)
	'808-shared-infra-fallback',
	// Seeded failing story test: fix it and finish with tests green (old 911)
	'810-fix-failing-tests',
	// Seeded a11y violations: fix the semantic one, surface the visual one (old 912)
	'811-fix-a11y-violations',
	// Storybook@next installed but zero stories: first story + review on the
	// minimal vite-app template
	'812-first-story-empty-project',
	// The runnable Storybook lives in a workspace leaf package (spec secondary axis)
	'813-monorepo-leaf-create-component',
] as const;

// The 82x block: lifecycle-skill evals (storybook-init / storybook-upgrade).
// They only run on the plugin experiments — the MCP experiments require a
// Storybook already running at :6006/mcp, which is exactly what these
// fixtures don't have. Pass criteria are the lifecycle outcome only; see the
// fixtures and storybookjs/mcp#324.
const LIFECYCLE_STORYBOOK_EVALS = [
	// No Storybook at all: the storybook-init skill drives setup
	'820-init-no-storybook',
	// Storybook 9.x preinstalled: major upgrade via the storybook-upgrade skill
	'821-upgrade-from-sb9',
	// Older stable (10.4.0) preinstalled: minor/patch upgrade path
	'822-upgrade-from-stable',
] as const;

// The 9xx line: evals ported from the old eval system (/eval), written for
// the MCP-only workflow. On default (`next`) CI runs they are too expensive
// and currently too flaky, so they only run under EVAL_STORYBOOK_LATEST=1
// (or manually via EVAL_ONLY). See storybookjs/mcp#315.
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
// EVAL_ONLY=<name>[,<name>] narrows the set to specific evals (core 8xx,
// lifecycle 82x, or ported 9xx) for local debugging, one eval at a time.
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

// The MCP experiments never run the lifecycle 82x evals: they configure the
// agent against a Storybook that must already be running at :6006/mcp, which
// the lifecycle fixtures intentionally don't have.
export const WORKFLOW_STORYBOOK_EVALS: EvalName[] = ACTIVE_EVALS.core;

// Plugin-integration experiments run zero evals under EVAL_STORYBOOK_LATEST=1:
// the plugin skills are not compatible with the stable Storybook release, so
// only the MCP experiments exercise the 9xx line there. On default runs they
// additionally cover the lifecycle 82x evals, whose skills only exist on the
// plugin path.
export const PLUGIN_STORYBOOK_EVALS: EvalName[] = STORYBOOK_LATEST
	? []
	: [...ACTIVE_EVALS.core, ...ACTIVE_EVALS.lifecycle];

// Non-default model tiers (e.g. cc-plugin-sonnet-medium) run zero evals unless
// explicitly enabled, so labeled CI runs only pay for the default-model
// experiments. Enable with EVAL_EXTRA_MODELS=1 (locally or via the
// workflow_dispatch input in CI).
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
	sandbox: 'auto',
	copyFiles: 'all',
	// Disabling the scripts for now, as this is flaky, and not often OUR fault
	// scripts: ['typecheck', 'build', 'test:stories', 'lint'],
} satisfies Partial<ExperimentConfig>;
