import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const agentEvalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resultsRoot = join(agentEvalRoot, 'results');
const TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function listDirectories(path) {
	if (!existsSync(path)) {
		return [];
	}

	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

// Results are laid out as <experiment path>/<timestamp>/<eval>/summary.json,
// where the experiment path may be nested (e.g. cc-plugin/native-default).
function findTimestampDirectories(dir = resultsRoot) {
	return listDirectories(dir).flatMap((name) => {
		const path = join(dir, name);

		return TIMESTAMP_DIR.test(name) ? [path] : findTimestampDirectories(path);
	});
}

function collectEvals(runRoot) {
	return listDirectories(runRoot).flatMap((name) => {
		const summaryPath = join(runRoot, name, 'summary.json');

		if (!existsSync(summaryPath)) {
			return [];
		}

		const classificationPath = join(runRoot, name, 'classification.json');

		return [
			{
				name,
				summary: readJson(summaryPath),
				classification: existsSync(classificationPath) ? readJson(classificationPath) : null,
			},
		];
	});
}

function collectExperiments() {
	const latestRunByExperiment = new Map();

	for (const runRoot of findTimestampDirectories()) {
		const experiment = relative(resultsRoot, dirname(runRoot)).split(sep).join('/');
		const previous = latestRunByExperiment.get(experiment);

		// Timestamps are ISO-based, so lexicographic comparison finds the latest run.
		if (!previous || runRoot > previous) {
			latestRunByExperiment.set(experiment, runRoot);
		}
	}

	return [...latestRunByExperiment.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([experiment, runRoot]) => ({
			experiment,
			timestamp: relative(dirname(runRoot), runRoot),
			evals: collectEvals(runRoot),
		}));
}

// Classifier output is free-form: strip newlines, pipes, and backticks so a
// reason can never break out of its markdown table cell.
function sanitizeCell(value) {
	return String(value ?? '')
		.replaceAll(/\s+/g, ' ')
		.replaceAll('|', '\\|')
		.replaceAll('`', "'")
		.trim();
}

function renderEvalRow({ name, summary, classification }) {
	const passed = summary.passedRuns === summary.totalRuns;
	const status = passed ? '✅' : '❌';
	const duration =
		typeof summary.meanDuration === 'number' ? `${summary.meanDuration.toFixed(1)}s` : '—';
	const failure = classification
		? `\`${sanitizeCell(classification.failureType)}\` — ${sanitizeCell(classification.failureReason)}`
		: '';

	return `| ${status} | \`${name}\` | ${summary.passedRuns}/${summary.totalRuns} (${summary.passRate}) | ${duration} | ${failure} |`;
}

function renderExperiment({ experiment, timestamp, evals }) {
	if (evals.length === 0) {
		return `#### \`${experiment}\`\n\n_No results._`;
	}

	return [
		`#### \`${experiment}\` (${timestamp})`,
		'',
		'| | Eval | Pass rate | Mean duration | Failure |',
		'|---|---|---|---|---|',
		...evals.map(renderEvalRow),
	].join('\n');
}

const experiments = collectExperiments();
const evals = experiments.flatMap(({ evals: experimentEvals }) => experimentEvals);
const passedEvals = evals.filter(({ summary }) => summary.passedRuns === summary.totalRuns);
const playgroundUrl = process.env.PLAYGROUND_URL;
const runUrl = process.env.RUN_URL;

const sections = [
	[
		'### Agent eval results',
		'',
		`**${passedEvals.length}/${evals.length} evals passed**${runUrl ? ` ([workflow run](${runUrl}))` : ''}`,
	].join('\n'),
];

if (playgroundUrl) {
	sections.push(`Playground: ${playgroundUrl}`);
}

if (experiments.length > 0) {
	sections.push(
		[
			'<details>',
			'<summary>Results by experiment</summary>',
			'',
			experiments.map(renderExperiment).join('\n\n'),
			'',
			'</details>',
		].join('\n'),
	);
}

process.stdout.write(`${sections.join('\n\n')}\n`);
