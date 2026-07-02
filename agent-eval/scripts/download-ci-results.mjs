#!/usr/bin/env node
// Downloads the most recent agent-eval-results artifacts from GitHub Actions
// and extracts them into agent-eval/results, so CI runs are inspectable in the
// local playground (pnpm playground) and by local analysis tooling.
//
// Usage: node scripts/download-ci-results.mjs [count]
//   count: number of artifacts to download (default 20)
//
// Requires an authenticated GitHub CLI (gh auth login). Result snapshots are
// keyed by experiment name and run timestamp, so artifacts from different CI
// runs merge into the results directory without colliding, and re-downloading
// the same artifact is idempotent.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACT_NAME = 'agent-eval-results';
const agentEvalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const count = Number(process.argv[2] ?? '20');
if (!Number.isInteger(count) || count < 1 || count > 100) {
	console.error(`Expected count between 1 and 100, got: ${process.argv[2]}`);
	process.exit(1);
}

function gh(args, options = {}) {
	try {
		return execFileSync('gh', args, { maxBuffer: 1024 * 1024 * 1024, ...options });
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.error('The GitHub CLI (gh) is required. Install it and run: gh auth login');
			process.exit(1);
		}
		throw error;
	}
}

const artifacts = JSON.parse(
	gh(
		[
			'api',
			`repos/{owner}/{repo}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100`,
			'--jq',
			'.artifacts | map(select(.expired | not))',
		],
		{ encoding: 'utf8' },
	),
)
	.sort((a, b) => b.created_at.localeCompare(a.created_at))
	.slice(0, count);

if (artifacts.length === 0) {
	console.error(`No unexpired ${ARTIFACT_NAME} artifacts found.`);
	process.exit(1);
}

console.log(`Downloading ${artifacts.length} ${ARTIFACT_NAME} artifact(s) into ${path.join(agentEvalDir, 'results')}`);

for (const artifact of artifacts) {
	const run = artifact.workflow_run ?? {};
	console.log(
		`- artifact ${artifact.id} (${artifact.created_at}, branch ${run.head_branch ?? 'unknown'}, run ${run.id ?? 'unknown'})`,
	);

	const workDir = mkdtempSync(path.join(tmpdir(), 'agent-eval-artifact-'));
	try {
		const zipPath = path.join(workDir, 'artifact.zip');
		writeFileSync(zipPath, gh(['api', `repos/{owner}/{repo}/actions/artifacts/${artifact.id}/zip`]));
		execFileSync('unzip', ['-oq', zipPath, '-d', workDir]);
		// The artifact wraps the results directory in a tarball; see the
		// "Archive eval results" step in .github/workflows/agent-eval.yml.
		execFileSync('tar', ['-xzf', path.join(workDir, `${ARTIFACT_NAME}.tgz`), '-C', agentEvalDir]);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

console.log('Done. Browse the results with: pnpm playground');
