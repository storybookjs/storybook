#!/usr/bin/env node
// Downloads the most recent agent-eval-results artifacts from GitHub Actions
// and extracts them into agent-eval/results, so CI runs are inspectable in the
// local playground (yarn workspace agent-eval run playground) and by local analysis tooling.
//
// Usage: node scripts/download-ci-results.mjs [count]
//   count: number of artifacts to download (default 20)
//
// Requires an authenticated GitHub CLI (gh auth login) and a tar binary.
// Result snapshots are keyed by experiment name and run timestamp, so
// artifacts from different CI runs merge into the results directory without
// colliding, and re-downloading the same artifact is idempotent.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACT_NAME = 'agent-eval-results';
const agentEvalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = path.join(agentEvalDir, 'results');

const count = Number(process.argv[2] ?? '20');
if (!Number.isInteger(count) || count < 1 || count > 100) {
  console.error(`Expected count between 1 and 100, got: ${process.argv[2]}`);
  process.exit(1);
}

function gh(args, options = {}) {
  try {
    // cwd pins gh's repo resolution to this checkout, so the script also
    // works when invoked from outside the repository.
    return execFileSync('gh', args, { cwd: agentEvalDir, ...options });
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
    { encoding: 'utf8' }
  )
)
  .sort((a, b) => b.created_at.localeCompare(a.created_at))
  .slice(0, count);

if (artifacts.length === 0) {
  console.error(`No unexpired ${ARTIFACT_NAME} artifacts found.`);
  process.exit(1);
}

console.log(`Downloading ${artifacts.length} ${ARTIFACT_NAME} artifact(s) into ${resultsDir}`);

// One artifact carrying no results is a normal outcome: a workflow whose runs
// all died before writing a snapshot still archives an (empty) tarball. Such an
// artifact must not cost the run its siblings, so every artifact is downloaded
// independently and failures are collected rather than thrown.
const skipped = [];
let downloaded = 0;

for (const artifact of artifacts) {
  const run = artifact.workflow_run;
  if (!run?.id) {
    skipped.push({ label: `artifact ${artifact.id}`, reason: 'no workflow run recorded' });
    continue;
  }
  const label = `artifact ${artifact.id} (${artifact.created_at}, branch ${run.head_branch ?? 'unknown'}, run ${run.id})`;

  const workDir = mkdtempSync(path.join(tmpdir(), 'agent-eval-artifact-'));
  try {
    // gh streams the artifact zip to disk and unpacks it, leaving the
    // tarball produced by the "Archive eval results" step in
    // .github/workflows/agent-eval.yml.
    gh(['run', 'download', String(run.id), '--name', ARTIFACT_NAME, '--dir', workDir], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    // Extract inside the temp directory and only the results/ subtree, so
    // an artifact tarball can never write outside it; then merge that
    // subtree into agent-eval/results. A tarball with no results/ member
    // holds no snapshots and tar exits non-zero on it.
    execFileSync(
      'tar',
      ['-xzf', path.join(workDir, `${ARTIFACT_NAME}.tgz`), '-C', workDir, 'results'],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    cpSync(path.join(workDir, 'results'), resultsDir, { recursive: true });
    downloaded += 1;
    console.log(`- ${label}`);
  } catch (error) {
    const detail = String(error.stderr ?? error.message ?? error)
      .trim()
      .split('\n')[0];
    skipped.push({ label, reason: detail || 'download or extraction failed' });
    console.warn(`- skipped ${label}: ${detail}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

if (skipped.length > 0) {
  console.warn(`\n${skipped.length} of ${artifacts.length} artifact(s) yielded no results:`);
  for (const { label, reason } of skipped) {
    console.warn(`  - ${label}: ${reason}`);
  }
}

if (downloaded === 0) {
  console.error('\nNo results were downloaded.');
  process.exit(1);
}

console.log(
  `\nDownloaded ${downloaded} artifact(s). Browse the results with: yarn workspace agent-eval run playground`
);
