/**
 * Retrigger CI on evaluation branches by busting the NX cache.
 *
 * Usage:
 *   yarn jiti scripts/retrigger-ci.ts [--runs N] [--dry-run]
 *
 * Options:
 *   --runs N    Number of runs per WORKFLOW (default: 20)
 *               normal and merged each have 1 branch → N pushes each
 *               daily has 2 branches → N/2 pushes each (rounded up)
 *   --dry-run   Print what would happen without pushing
 *
 * Schedule (staggered to avoid concurrent runs):
 *   :00  kasper/nx-eval-normal   (every 30 min, N runs)
 *   :10  kasper/nx-eval-merged   (every 30 min, N runs)
 *   :20  kasper/nx-eval-daily-1  (every 45 min, N/2 runs)
 *   :35  kasper/nx-eval-daily-2  (every 45 min, N/2 runs)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const NX_JSON = join(REPO_ROOT, 'nx.json');

interface BranchConfig {
  branch: string;
  intervalMin: number;
  offsetMin: number;
  maxRuns: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let runs = 20;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runs') runs = parseInt(args[++i], 10);
    else if (args[i] === '--dry-run') dryRun = true;
    else {
      console.error(`Unknown option: ${args[i]}`);
      process.exit(1);
    }
  }

  return { runs, dryRun };
}

function git(cmd: string) {
  return execSync(`git ${cmd}`, { cwd: REPO_ROOT, stdio: 'pipe' }).toString().trim();
}

function bustAndPush(branch: string, runNum: number) {
  git(`checkout ${branch} --quiet`);

  const timestamp = new Date().toISOString();
  const nxJson = readFileSync(NX_JSON, 'utf-8');
  const updated = nxJson.replace(/"codexCacheBust": ".*"/, `"codexCacheBust": "${timestamp}"`);
  writeFileSync(NX_JSON, updated);

  git('add nx.json');
  git(`commit --quiet -m "chore: retrigger CI (run ${runNum}) — ${timestamp}" --no-verify`);
  git(`push --quiet origin ${branch}`);

  log(`Pushed ${branch} (run ${runNum})`);
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  console.log(`[${time}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { runs, dryRun } = parseArgs();
  const dailyRuns = Math.ceil(runs / 2);

  const branches: BranchConfig[] = [
    { branch: 'kasper/nx-eval-normal', intervalMin: 30, offsetMin: 0, maxRuns: runs },
    { branch: 'kasper/nx-eval-merged', intervalMin: 30, offsetMin: 10, maxRuns: runs },
    { branch: 'kasper/nx-eval-daily-1', intervalMin: 45, offsetMin: 20, maxRuns: dailyRuns },
    { branch: 'kasper/nx-eval-daily-2', intervalMin: 45, offsetMin: 35, maxRuns: dailyRuns },
  ];

  const currentBranch = git('branch --show-current');
  const runCounts = branches.map(() => 0);
  const nextPush = branches.map((b) => Date.now() + b.offsetMin * 60_000);

  console.log('=== CI Retrigger Script ===');
  console.log(`Runs per workflow: ${runs} (daily split: ${dailyRuns} × 2 branches)`);
  console.log(`Dry run: ${dryRun}`);
  for (const b of branches) {
    console.log(
      `  ${b.branch}: ${b.maxRuns} runs, every ${b.intervalMin}min, offset +${b.offsetMin}min`
    );
  }
  console.log('');

  const allDone = () => branches.every((b, i) => runCounts[i] >= b.maxRuns);

  while (!allDone()) {
    const now = Date.now();

    for (let i = 0; i < branches.length; i++) {
      if (runCounts[i] >= branches[i].maxRuns) continue;
      if (now < nextPush[i]) continue;

      runCounts[i]++;

      if (dryRun) {
        log(`Would push ${branches[i].branch} (run ${runCounts[i]})`);
      } else {
        bustAndPush(branches[i].branch, runCounts[i]);
      }

      nextPush[i] = now + branches[i].intervalMin * 60_000;
    }

    if (allDone()) break;

    const nextEvent = Math.min(...nextPush.filter((_, i) => runCounts[i] < branches[i].maxRuns));
    const sleepMs = Math.max(0, nextEvent - Date.now());
    const nextBranch = branches[nextPush.indexOf(nextEvent)]?.branch ?? '?';

    log(`Sleeping ${Math.round(sleepMs / 1000)}s until next push (${nextBranch})...`);
    await sleep(sleepMs);
  }

  git(`checkout ${currentBranch} --quiet`);

  console.log('');
  console.log('=== Done ===');
  console.log('Total pushes per branch:');
  for (let i = 0; i < branches.length; i++) {
    console.log(`  ${branches[i].branch}: ${runCounts[i]}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
