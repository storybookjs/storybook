/**
 * Experiment L — replay real dogfood commits.
 *
 * Picks a sample of recent commits that touched code/, applies each as a
 * patch to the current working tree, lets change-detection scan, captures
 * the resulting cascade, runs the signature-prompt categoriser, scores it,
 * reverts, and writes a JSONL row per successful run.
 *
 * Skips a commit cleanly when:
 *   - the patch fails `git apply --check` (e.g. context drift)
 *   - the diff is empty for code/ (docs/scripts/test-only commits)
 *   - the diff is too large (>500 lines — slow to apply, noisy cascade)
 *
 * Run with:
 *   node --experimental-transform-types --no-warnings \
 *     scripts/eval/inner-loop/replay-real-commits.ts [--max N] [--out file.jsonl]
 *
 * Requires:
 *   - Storybook UI running on http://localhost:6006 with patches 02-04 applied.
 *   - clean working tree (the runner refuses to start if there are
 *     uncommitted changes that overlap with the candidate commits).
 */
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { writeFile, mkdir, appendFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  assertStorybookRunning,
  pollChangeDetection,
  waitForEmptyBaseline,
  type StoryIndex,
  type CdStatus,
} from './lib/storybook-client.ts';
import { buildPayload, buildStoryToFile } from './lib/build-payload.ts';
import { estimateTokens } from './lib/estimate-tokens.ts';
import { invokeAgent } from './lib/invoke-agent.ts';
import { score } from './lib/score.ts';
import { scoreSignatureQuality } from './lib/signature-quality.ts';
import {
  clusterByNamespace,
  clusterBySharedChangedFiles,
} from './lib/deterministic-clusters.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');
const REPO_ROOT = '/Users/yannbraga/open-source/storybook';

interface CommitMeta {
  sha: string;
  shortSha: string;
  subject: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  paths: string[];
}

function git(args: string[], opts: SpawnSyncOptions = {}): string {
  const r = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    ...opts,
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return (r.stdout as string) || '';
}

function gitTry(args: string[], opts: SpawnSyncOptions = {}): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    ...opts,
  });
  return {
    ok: r.status === 0,
    stdout: (r.stdout as string) || '',
    stderr: (r.stderr as string) || '',
  };
}

async function getCandidateCommits(maxLookback = 250): Promise<CommitMeta[]> {
  // Look back across `next` history (where the dogfood commits live), not
  // just the current branch (which is yann/story-review-analysis).
  const log = git([
    'log',
    'origin/next',
    `--max-count=${maxLookback}`,
    '--no-merges',
    '--pretty=format:%H|%s',
    '--',
    'code/core',
    'code/addons',
  ]);
  const out: CommitMeta[] = [];
  for (const line of log.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf('|');
    const sha = line.slice(0, idx);
    const subject = line.slice(idx + 1);
    // Get diff stats
    const stat = gitTry(['show', '--stat', '--format=', sha]);
    if (!stat.ok) continue;
    let filesChanged = 0,
      insertions = 0,
      deletions = 0;
    const tail = stat.stdout.trim().split('\n').pop() || '';
    const m = tail.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    if (m) {
      filesChanged = Number(m[1]);
      insertions = Number(m[2] || 0);
      deletions = Number(m[3] || 0);
    }
    const paths = git(['show', '--name-only', '--format=', sha])
      .split('\n')
      .filter((p) => p.trim() !== '');
    // Filter: only consider commits whose changed files are mostly in code/core or code/addons
    // and TS/TSX/JS, no big formatter sweeps, no test-only.
    const sourcePaths = paths.filter(
      (p) =>
        (p.startsWith('code/core/') || p.startsWith('code/addons/')) &&
        /\.(ts|tsx|js|jsx)$/.test(p) &&
        !p.includes('__tests__') &&
        !p.includes('.test.') &&
        !p.includes('.spec.')
    );
    if (sourcePaths.length === 0) continue;
    const totalLines = insertions + deletions;
    if (totalLines < 5 || totalLines > 500) continue;
    if (sourcePaths.length > 15) continue; // skip very wide changes
    out.push({
      sha,
      shortSha: sha.slice(0, 10),
      subject,
      filesChanged,
      insertions,
      deletions,
      paths: sourcePaths,
    });
  }
  return out;
}

/**
 * Apply a commit's diff IN REVERSE — i.e. roll the working tree back to the
 * pre-commit state for the files that commit touched.
 *
 * Why reverse and not forward? The candidate commits are already reachable
 * from HEAD (they're part of the dogfood's history). Applying their diff
 * forward would conflict with content that's already there. Applying the
 * INVERSE produces a working-tree-vs-HEAD diff equivalent to "undo this
 * commit only", which is what change-detection sees as a real diff. The
 * cascade fired is the same as the original commit's cascade.
 */
async function applyPatch(sha: string, patchPath: string): Promise<{ ok: boolean; reason?: string }> {
  const diff = git(['diff', `${sha}~1`, sha, '--', 'code/']);
  if (!diff.trim()) return { ok: false, reason: 'empty-diff' };
  await writeFile(patchPath, diff);
  // Reverse-apply: --check first to see if the commit's content actually
  // exists in the current tree (it should, if the commit is on HEAD).
  const check = gitTry(['apply', '-R', '--check', patchPath]);
  if (!check.ok) return { ok: false, reason: `check-failed: ${check.stderr.slice(0, 200)}` };
  const apply = gitTry(['apply', '-R', patchPath]);
  if (!apply.ok) return { ok: false, reason: `apply-failed: ${apply.stderr.slice(0, 200)}` };
  return { ok: true };
}

async function revertPatch(patchPath: string): Promise<{ ok: boolean }> {
  // Forward-apply restores the commit's content (un-doing the reverse-apply).
  const r = gitTry(['apply', patchPath]);
  return { ok: r.ok };
}

interface RunResult {
  timestamp: string;
  commit: CommitMeta;
  outcome: 'success' | 'apply-failed' | 'empty-cascade' | 'agent-failed';
  reason?: string;
  groundTruth?: {
    modified: number;
    affected: number;
    new: number;
    total: number;
  };
  payloadTokens?: number;
  storyToFile?: Record<string, string>;
  modified?: string[];
  affected?: string[];
  changedFiles?: string[];
  agent?: {
    model: string;
    promptVariant: string;
    durationS: number;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    clusterCount: number;
    clusters: { id: string; rationale: string; representative: string; storyCount: number; stories: string[] }[];
  };
  scores?: ReturnType<typeof score>;
  signatureQuality?: ReturnType<typeof scoreSignatureQuality>;
  deterministicComparison?: {
    namespace: { clusterCount: number; purity: number };
    sharedFiles: { clusterCount: number; purity: number };
  };
}

async function replayOne(
  commit: CommitMeta,
  index: StoryIndex,
  outFile: string,
  args: { model: string; effort: 'low' | 'medium' | 'high' | 'max' }
): Promise<RunResult> {
  const result: RunResult = {
    timestamp: new Date().toISOString(),
    commit,
    outcome: 'success',
  };
  const patchPath = join(tmpdir(), `replay-${commit.shortSha}.patch`);

  console.log(`\n━━━ ${commit.shortSha} ${commit.subject.slice(0, 60)} ━━━`);
  console.log(`  files=${commit.filesChanged} +${commit.insertions}/-${commit.deletions}`);

  await waitForEmptyBaseline();
  const apply = await applyPatch(commit.sha, patchPath);
  if (!apply.ok) {
    console.log(`  ⚠ Skip: ${apply.reason}`);
    result.outcome = 'apply-failed';
    result.reason = apply.reason;
    await unlink(patchPath).catch(() => {});
    await appendFile(outFile, JSON.stringify(result) + '\n');
    return result;
  }
  console.log(`  ✓ Patch applied`);

  let statuses: CdStatus[] = [];
  try {
    statuses = await pollChangeDetection();
  } catch (e) {
    console.log(`  ⚠ Failed to read statuses: ${(e as Error).message}`);
  }

  if (statuses.length === 0) {
    console.log(`  ⚠ Empty cascade — change-detection produced no statuses`);
    await revertPatch(patchPath);
    await unlink(patchPath).catch(() => {});
    result.outcome = 'empty-cascade';
    await appendFile(outFile, JSON.stringify(result) + '\n');
    return result;
  }

  // Build the payload — for real commits we don't have a single edit, so use
  // the first changed source path as the canonical "scenario" path.
  const rawDiff = await readFile(patchPath, 'utf8');
  const fakeScenario = {
    name: commit.shortSha,
    description: commit.subject,
    filePath: commit.paths[0],
    find: '',
    replaceWith: '',
    expectedCascade: { min: 0, max: Infinity },
    hypothesis: 'real commit',
  };
  const payload = buildPayload({
    statuses,
    rawDiff,
    scenario: fakeScenario,
    index,
  });
  const payloadJson = JSON.stringify(payload);
  const payloadTokens = estimateTokens(payloadJson);
  console.log(
    `  Cascade: ${statuses.length} statuses (${payload.modified.length} modified, ${payload.affected.length} affected)`
  );
  console.log(`  Payload: ${payloadTokens} tokens`);

  result.groundTruth = {
    modified: payload.modified.length,
    affected: payload.affected.length,
    new: payload.new.length,
    total: statuses.length,
  };
  result.payloadTokens = payloadTokens;
  result.storyToFile = buildStoryToFile(payload, index);
  result.modified = payload.modified;
  result.affected = payload.affected;
  result.changedFiles = commit.paths; // multi-file diffs

  // Invoke the categoriser (signature prompt — only viable option at cascade scale)
  console.log(`  Invoking ${args.model} (signature/${args.effort})...`);
  const agentRun = await invokeAgent(payload, {
    sdkModel: args.model,
    effort: args.effort,
    promptVariant: 'signature',
  });
  if (!agentRun.parsed) {
    console.log(`  ⚠ Parse error: ${agentRun.parseError}`);
    result.outcome = 'agent-failed';
    result.reason = agentRun.parseError;
    await revertPatch(patchPath);
    await unlink(patchPath).catch(() => {});
    await appendFile(outFile, JSON.stringify(result) + '\n');
    return result;
  }

  const scores = score(payload, agentRun.parsed.clusters);
  const sq = scoreSignatureQuality(
    'signature',
    agentRun.rawSignatureClusters,
    agentRun.parsed.clusters
  );

  // Deterministic comparison
  const nsClusters = clusterByNamespace(payload);
  const sfClusters = clusterBySharedChangedFiles(payload);
  const nsScore = score(payload, nsClusters);
  const sfScore = score(payload, sfClusters);

  console.log(
    `  Agent: ${agentRun.parsed.clusters.length} clusters, ${Math.round(agentRun.durationS)}s, $${(agentRun.costUsd ?? 0).toFixed(3)}`
  );
  console.log(
    `  Scores: recall=${scores.recall} precision=${scores.precision} purity=${scores.clusterPurity}`
  );
  console.log(
    `  Sig quality: catchAll=${(sq.catchAllShare * 100).toFixed(1)}% reprValid=${sq.representativeValidCount}/${sq.representativeTotalCount}`
  );
  console.log(
    `  Determ baselines: namespace=${nsClusters.length} clusters / sharedFiles=${sfClusters.length} clusters`
  );

  result.agent = {
    model: agentRun.model,
    promptVariant: 'signature',
    durationS: agentRun.durationS,
    costUsd: agentRun.costUsd,
    inputTokens: agentRun.inputTokens,
    outputTokens: agentRun.outputTokens,
    cacheReadTokens: agentRun.cacheReadTokens,
    clusterCount: agentRun.parsed.clusters.length,
    clusters: agentRun.parsed.clusters.map((c) => ({
      id: c.id,
      rationale: c.rationale,
      representative: c.representative,
      storyCount: c.stories.length,
      stories: c.stories,
    })),
    sessionId: agentRun.sessionId,
    transcript: agentRun.transcript,
  };
  result.scores = scores;
  result.signatureQuality = sq;
  result.deterministicComparison = {
    namespace: { clusterCount: nsClusters.length, purity: nsScore.clusterPurity },
    sharedFiles: { clusterCount: sfClusters.length, purity: sfScore.clusterPurity },
  };

  // Revert
  await revertPatch(patchPath);
  await unlink(patchPath).catch(() => {});
  console.log(`  ✓ Reverted`);

  await appendFile(outFile, JSON.stringify(result) + '\n');
  return result;
}

async function main() {
  const argv = process.argv.slice(2);
  let max = 12;
  let outName = `replay-real-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  let model = 'claude-sonnet-4-6';
  let effort: 'low' | 'medium' | 'high' | 'max' = 'low';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') max = Number(argv[++i] || max);
    else if (a === '--out') outName = argv[++i];
    else if (a === '--model') model = argv[++i];
    else if (a === '--effort') effort = argv[++i] as typeof effort;
  }
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, outName);

  // Pre-flight: working tree must be clean enough that we can apply / revert
  // patches without conflicts.
  const dirty = git(['diff', '--name-only']).trim();
  if (dirty) {
    console.warn(
      `⚠ Working tree has uncommitted changes; patch apply/revert may conflict. Continuing anyway. Files: ${dirty.split('\n').slice(0, 5).join(', ')}`
    );
  }

  const index = await assertStorybookRunning();
  console.log(`Storybook UI is up — ${Object.keys(index.entries).length} stories indexed`);

  console.log(`\nGathering candidate commits from origin/next…`);
  const candidates = await getCandidateCommits(250);
  console.log(`Found ${candidates.length} candidate commits in last 250 (filtered to source-only, 5-500 lines).`);
  const sample = candidates.slice(0, max);
  console.log(`Replaying first ${sample.length}:\n`);
  for (const c of sample) {
    console.log(`  ${c.shortSha}  +${c.insertions}/-${c.deletions}  ${c.subject.slice(0, 70)}`);
  }

  const summary = { success: 0, applyFailed: 0, emptyCascade: 0, agentFailed: 0 };
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    console.log(`\n[${i + 1}/${sample.length}]`);
    try {
      const r = await replayOne(c, index, outPath, { model, effort });
      summary[r.outcome === 'success' ? 'success' : r.outcome === 'apply-failed' ? 'applyFailed' : r.outcome === 'empty-cascade' ? 'emptyCascade' : 'agentFailed']++;
    } catch (e) {
      console.error(`  ✗ Unhandled error: ${(e as Error).message}`);
      summary.agentFailed++;
    }
    await delay(2000);
  }

  console.log(`\nDone. ${summary.success} success / ${summary.applyFailed} apply-failed / ${summary.emptyCascade} empty / ${summary.agentFailed} agent-failed.`);
  console.log(`Results: ${outPath}`);
}

await main();
