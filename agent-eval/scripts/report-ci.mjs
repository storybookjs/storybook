import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RESULTS_DIR = path.resolve(process.env.AGENT_EVAL_RESULTS_DIR ?? 'results');
const TRACKING_ISSUE = 'https://github.com/storybookjs/mcp/issues/317';
const rawExitCode = readRawExitCode();

const resultRows = readResultRows();

if (rawExitCode !== 0 && resultRows.length === 0) {
	console.error(`agent-eval exited with ${rawExitCode} before writing analyzable results.`);
	process.exit(1);
}

const passed = [];
const infra = [];
const failed = [];

for (const row of resultRows) {
	if (row.passed) {
		passed.push(row);
		continue;
	}

	if (row.failureKind === 'infra') {
		infra.push(row);
	} else {
		failed.push(row);
	}
}

printSummary();

if (failed.length > 0) {
	process.exitCode = 1;
}

function readRawExitCode() {
	const exitCodePath = path.join(RESULTS_DIR, '.agent-eval-exit-code');
	if (!existsSync(exitCodePath)) {
		return 0;
	}
	const parsed = Number(readFileSync(exitCodePath, 'utf8').trim());
	return Number.isInteger(parsed) ? parsed : 1;
}

function readResultRows() {
	if (!existsSync(RESULTS_DIR)) {
		return [];
	}

	const rows = [];
	for (const experiment of readDirs(RESULTS_DIR)) {
		const experimentDir = path.join(RESULTS_DIR, experiment);
		for (const timestamp of readDirs(experimentDir)) {
			const timestampDir = path.join(experimentDir, timestamp);
			for (const evalName of readDirs(timestampDir)) {
				const evalDir = path.join(timestampDir, evalName);
				const summaryPath = path.join(evalDir, 'summary.json');
				if (!existsSync(summaryPath)) {
					continue;
				}

				const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
				const passedRuns = Number(summary.passedRuns ?? 0);
				const totalRuns = Number(summary.totalRuns ?? 0);
				const failedRuns = readFailedRuns(evalDir);
				const failureKind = failedRuns.every(isInfraFailure) ? 'infra' : 'eval';

				rows.push({
					experiment,
					eval: evalName,
					timestamp,
					passed: totalRuns > 0 && passedRuns > 0,
					passRate: String(summary.passRate ?? 'unknown'),
					failureKind,
					failures: failedRuns,
				});
			}
		}
	}
	return latestRows(rows);
}

function readDirs(dir) {
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort();
}

function readFailedRuns(evalDir) {
	const runs = [];
	for (const runDirName of readDirs(evalDir).filter((name) => name.startsWith('run-'))) {
		const runDir = path.join(evalDir, runDirName);
		const resultPath = path.join(runDir, 'result.json');
		if (!existsSync(resultPath)) {
			continue;
		}

		const result = JSON.parse(readFileSync(resultPath, 'utf8'));
		if (result.status !== 'failed') {
			continue;
		}

		const output = readOptional(path.join(runDir, 'outputs', 'eval.txt'));
		const scriptOutput = readScriptOutputs(path.join(runDir, 'outputs', 'scripts'));
		runs.push({
			run: runDirName,
			error: typeof result.error === 'string' ? result.error : '',
			output,
			scriptOutput,
		});
	}
	return runs;
}

function readScriptOutputs(scriptsDir) {
	if (!existsSync(scriptsDir)) {
		return '';
	}
	return readDirsOrFiles(scriptsDir)
		.map((fileName) => readOptional(path.join(scriptsDir, fileName)))
		.join('\n');
}

function readDirsOrFiles(dir) {
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name)
		.sort();
}

function readOptional(filePath) {
	if (!existsSync(filePath)) {
		return '';
	}
	return readFileSync(filePath, 'utf8');
}

function isInfraFailure(failure) {
	const text = `${failure.error}\n${failure.output}\n${failure.scriptOutput}`.toLowerCase();
	return [
		'api error',
		'positive credit balance',
		'rate limit',
		'tpm',
		'timed out',
		'stream disconnected',
		'econnreset',
		'etimedout',
		'authentication',
		'unauthorized',
		'forbidden',
		'429',
		'402',
		'401',
	].some((needle) => text.includes(needle));
}

function latestRows(rows) {
	const byEval = new Map();
	for (const row of rows) {
		const key = failureKey(row);
		const existing = byEval.get(key);
		if (!existing || row.timestamp > existing.timestamp) {
			byEval.set(key, row);
		}
	}
	return [...byEval.values()].sort((a, b) => failureKey(a).localeCompare(failureKey(b)));
}

function failureKey(row) {
	return `${row.experiment}/${row.eval}`;
}

function printSummary() {
	console.log('\nAgent eval CI report');
	console.log('====================');
	console.log(`Passed: ${passed.length}`);
	console.log(`Infrastructure/provider failures: ${infra.length}`);
	console.log(`Eval failures: ${failed.length}`);

	printRows('\nInfrastructure/provider failures', infra, firstFailureReason);
	printRows('\nEval failures', failed, firstFailureReason);

	if (failed.length > 0) {
		console.error(
			`\nEval failures must be fixed or intentionally documented above the relevant expect and tracked in ${TRACKING_ISSUE}.`,
		);
	}
}

function printRows(title, rows, detail) {
	if (rows.length === 0) {
		return;
	}

	console.log(title);
	for (const row of rows) {
		console.log(`- ${failureKey(row)} (${row.passRate}): ${truncate(detail(row), 180)}`);
	}
}

function firstFailureReason(row) {
	const failure = row.failures[0];
	return failure?.error || firstUsefulLine(failure?.output) || 'failed without a captured reason';
}

function firstUsefulLine(value = '') {
	return value
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean);
}

function truncate(value, length) {
	if (value.length <= length) {
		return value;
	}
	return `${value.slice(0, length - 3)}...`;
}
