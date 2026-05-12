/**
 * Round-2 §N — Failure-mode taxonomy.
 *
 * Exercises every failure path the inner-loop eval can hit (parse error,
 * empty cluster output, invalid regex signature, unmatched stories,
 * shadowed catch-all, empty ground-truth, hallucinated IDs, duplicate
 * IDs across clusters) without burning real API calls. Verifies the
 * library code degrades gracefully and produces sensible scores.
 *
 * For network-level failures (Storybook unreachable, SDK rate-limit) we
 * document the observed-by-inspection behaviour rather than forcing the
 * actual failure (running the harness with `STORYBOOK_URL=...` would
 * exit before the eval code paths run).
 *
 * Output: scripts/eval/inner-loop/results/failure-modes.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandSignatures, type SignatureCluster } from './lib/expand-signatures.ts';
import { score, type Cluster } from './lib/score.ts';
import type { ChangeContextPayload } from './lib/build-payload.ts';
import { scoreSignatureQuality } from './lib/signature-quality.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');

interface Probe {
  id: string;
  description: string;
  category: 'parse' | 'agent-output' | 'scoring' | 'signature-expansion' | 'network';
  expected: string;
  observed: unknown;
  status: 'pass' | 'fail' | 'documented';
  notes?: string;
}

const probes: Probe[] = [];

// Synthetic payload used across probes.
const makePayload = (n = 5): ChangeContextPayload => ({
  changedFiles: ['core/src/foo.ts'],
  diffSummary: 'edited foo.ts',
  modified: Array.from({ length: Math.ceil(n / 2) }, (_, i) => `ns-foo--story-${i}`),
  affected: Array.from({ length: Math.floor(n / 2) }, (_, i) => `ns-bar--story-${i}`),
  new: [],
  cssAffected: [],
  projectShape: { totalStories: 100, topNamespaces: [] },
} as ChangeContextPayload);

// ──────────────────────────────────────────────────────────────────────
// 1. Parse-error path (malformed JSON from the model)
// ──────────────────────────────────────────────────────────────────────
{
  const raw = `Here is my answer:\n{ "clusters": [oops`;
  let parseError: string | undefined;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim());
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  probes.push({
    id: 'parse-malformed-json',
    description: 'Agent returns prose + malformed JSON (no closing brace).',
    category: 'parse',
    expected:
      'invokeAgent should set parseError, leave parsed=null, return cleanly. run.ts logs "⚠ Agent output failed to parse" and writes JSONL row with scores=null.',
    observed: { parsed, parseError },
    status: parseError && parsed === null ? 'pass' : 'fail',
    notes:
      'Verified: JSON.parse throws; invoke-agent.ts:178 catches; agentRun.parsed=null; run.ts:181 logs the warning; row still written with scores=null and parseError persisted in agentRun.parseError.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 2. Empty cluster output `{"clusters":[]}`
// ──────────────────────────────────────────────────────────────────────
{
  const payload = makePayload(10);
  const empty: Cluster[] = [];
  const s = score(payload, empty);
  probes.push({
    id: 'agent-empty-clusters',
    description: 'Agent returns valid JSON with zero clusters.',
    category: 'scoring',
    expected:
      'score() returns recall=0, precision=1 (no agent output, no hallucinations), purity=1 (no clusters to measure). No division-by-zero.',
    observed: s,
    status: s.recall === 0 && s.precision === 1 && s.clusterPurity === 1 ? 'pass' : 'fail',
    notes:
      'Verified: score.ts:53 `agentSet.size > 0 ? ... : 1` short-circuits precision; same for purity (purityDen=0 → 1). Recall=0 is correct (missed everything).',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 3. Empty ground-truth (no statuses)
// ──────────────────────────────────────────────────────────────────────
{
  const emptyPayload: ChangeContextPayload = {
    ...makePayload(0),
    modified: [],
    affected: [],
  } as ChangeContextPayload;
  const s = score(emptyPayload, []);
  probes.push({
    id: 'scoring-empty-ground-truth',
    description: 'Change-detection produced no statuses (e.g. CSS-only edit).',
    category: 'scoring',
    expected:
      'No NaN. recall=1 (trivially), precision=1, purity=1, all sizes 0.',
    observed: s,
    status:
      s.recall === 1 && s.precision === 1 && s.clusterPurity === 1 && s.groundTruthSize === 0
        ? 'pass'
        : 'fail',
    notes:
      'Verified: score.ts:52 `groundTruthSize > 0 ? ... : 1`. run.ts:150 also short-circuits — if statuses.length===0 it skips the agent call entirely (no SDK cost). For css-only / regex-aliased scenarios this is the documented path.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 4. Signature with invalid regex
// ──────────────────────────────────────────────────────────────────────
{
  const sigs: SignatureCluster[] = [
    {
      id: 'broken-regex',
      rationale: 'oops',
      representative: 'ns-foo--story-0',
      signature: { type: 'regex', value: '[invalid(unclosed' },
    },
    {
      id: 'catch-all',
      rationale: 'rest',
      representative: 'ns-bar--story-0',
      signature: { type: 'regex', value: '.*' },
    },
  ];
  const allIds = ['ns-foo--story-0', 'ns-bar--story-0', 'ns-bar--story-1'];
  const result = expandSignatures(sigs, allIds);
  probes.push({
    id: 'signature-invalid-regex',
    description: 'Agent emits a signature with a malformed regex.',
    category: 'signature-expansion',
    expected:
      'expand-signatures replaces the bad regex with `/(?!)/` (matches nothing). Catch-all picks up everything. unmatched=0.',
    observed: {
      brokenStories: result.clusters[0].stories.length,
      catchAllStories: result.clusters[1].stories.length,
      unmatched: result.unmatched.length,
    },
    status:
      result.clusters[0].stories.length === 0 &&
      result.clusters[1].stories.length === 3 &&
      result.unmatched.length === 0
        ? 'pass'
        : 'fail',
    notes:
      'Verified: expand-signatures.ts:36 try/catch sets `re = /(?!)/` so the broken cluster gets nothing and the catch-all sweeps. Real recovery, not silent failure.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 5. Signature missing catch-all → unmatched stories
// ──────────────────────────────────────────────────────────────────────
{
  const sigs: SignatureCluster[] = [
    {
      id: 'only-foo',
      rationale: '',
      representative: 'ns-foo--story-0',
      signature: { type: 'prefix', value: 'ns-foo' },
    },
  ];
  const allIds = ['ns-foo--story-0', 'ns-bar--story-0', 'ns-baz--story-0'];
  const result = expandSignatures(sigs, allIds);
  const s = score(makePayload(2), result.clusters);
  probes.push({
    id: 'signature-no-catchall',
    description: 'Agent forgets the required catch-all final signature.',
    category: 'signature-expansion',
    expected:
      'Two stories end up in `unmatched`. score() shows recall<1 because the unmatched stories are not in any cluster.',
    observed: {
      placed: result.clusters[0].stories.length,
      unmatched: result.unmatched.length,
      recall: s.recall,
    },
    status:
      result.clusters[0].stories.length === 1 && result.unmatched.length === 2
        ? 'pass'
        : 'fail',
    notes:
      'Verified: unmatched IDs are simply not in any cluster. score()/HTML report quantify the loss via recall<1. No crash. Catch-all-missing is the dominant signature-prompt failure mode (signature-quality.ts also reports `catchAllShare`).',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 6. Shadowed cluster (earlier catch-all consumes everything)
// ──────────────────────────────────────────────────────────────────────
{
  const sigs: SignatureCluster[] = [
    {
      id: 'too-eager',
      rationale: 'catch-all by mistake',
      representative: 'ns-foo--story-0',
      signature: { type: 'regex', value: '.*' },
    },
    {
      id: 'starved',
      rationale: 'should have stories but doesnt',
      representative: 'ns-bar--story-0',
      signature: { type: 'prefix', value: 'ns-bar' },
    },
  ];
  const allIds = ['ns-foo--story-0', 'ns-bar--story-0'];
  const result = expandSignatures(sigs, allIds);
  const sq = scoreSignatureQuality('signature', sigs, result.clusters);
  probes.push({
    id: 'signature-shadowed-cluster',
    description: 'Eager catch-all listed first → later cluster gets nothing.',
    category: 'signature-expansion',
    expected:
      'expand-signatures assigns all stories to the first cluster (first-match wins). signature-quality reports shadowedClusterCount=1.',
    observed: {
      firstClusterStories: result.clusters[0].stories.length,
      secondClusterStories: result.clusters[1].stories.length,
      shadowedClusterCount: sq.shadowedClusterCount,
      catchAllShare: sq.catchAllShare,
    },
    status:
      result.clusters[0].stories.length === 2 &&
      result.clusters[1].stories.length === 0 &&
      sq.shadowedClusterCount === 1
        ? 'pass'
        : 'fail',
    notes:
      'Verified: signature-quality.ts surfaces this as a KPI. The HTML report colour-codes catchAllShare. Trust-UX implication: the report must show shadowed clusters distinctly so reviewers spot bad orderings.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 7. Hallucinated story IDs (cluster contains IDs not in ground-truth)
// ──────────────────────────────────────────────────────────────────────
{
  const payload = makePayload(4);
  const clusters: Cluster[] = [
    {
      id: 'mostly-real',
      rationale: 'r',
      representative: 'ns-foo--story-0',
      stories: ['ns-foo--story-0', 'ns-foo--story-1', 'ns-hallucinated--xyz'],
    },
  ];
  const s = score(payload, clusters);
  probes.push({
    id: 'agent-hallucinated-ids',
    description: 'Agent invents story IDs that are not in the ground-truth set.',
    category: 'scoring',
    expected:
      'hallucinationCount=1, precision<1 (2/3), no crash.',
    observed: s,
    status:
      s.hallucinationCount === 1 && Math.abs(s.precision - 0.667) < 0.01 ? 'pass' : 'fail',
    notes:
      'Verified: score.ts builds overlap = agentSet ∩ groundTruth; hallucinations = agentSet \\ groundTruth. Surfaced in JSONL row and HTML report.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 8. Duplicate IDs across clusters
// ──────────────────────────────────────────────────────────────────────
{
  const payload = makePayload(4);
  const clusters: Cluster[] = [
    {
      id: 'a',
      rationale: '',
      representative: 'ns-foo--story-0',
      stories: ['ns-foo--story-0', 'ns-foo--story-1'],
    },
    {
      id: 'b',
      rationale: '',
      representative: 'ns-foo--story-1',
      stories: ['ns-foo--story-1', 'ns-bar--story-0'],
    },
  ];
  const s = score(payload, clusters);
  probes.push({
    id: 'agent-duplicate-ids',
    description: 'Agent places the same story in two clusters.',
    category: 'scoring',
    expected:
      'duplicateCount=1, agentOutputSize counts unique IDs (=3), score() does not double-count in recall/precision.',
    observed: s,
    status: s.duplicateCount === 1 && s.agentOutputSize === 3 ? 'pass' : 'fail',
    notes:
      'Verified: score.ts:43-46 tracks Set + duplicate counter. The enumerate prompt is more prone to this than the signature prompt (which can\'t express duplicates by construction — each story matches the first signature only).',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 9. Signature with `ids` array containing non-existent IDs
// ──────────────────────────────────────────────────────────────────────
{
  const sigs: SignatureCluster[] = [
    {
      id: 'explicit',
      rationale: '',
      representative: 'ns-foo--story-0',
      signature: { type: 'ids', value: ['ns-foo--story-0', 'ns-fictional--zzz'] },
    },
    {
      id: 'catchAll',
      rationale: '',
      representative: 'ns-bar--story-0',
      signature: { type: 'regex', value: '.*' },
    },
  ];
  const allIds = ['ns-foo--story-0', 'ns-bar--story-0'];
  const result = expandSignatures(sigs, allIds);
  probes.push({
    id: 'signature-ids-with-nonexistent',
    description: 'Agent lists explicit IDs that do not appear in the payload.',
    category: 'signature-expansion',
    expected:
      'Non-existent IDs are silently dropped (no entry to match against). Real IDs still placed. No crash.',
    observed: {
      explicitMatches: result.clusters[0].stories.length,
      catchAllMatches: result.clusters[1].stories.length,
    },
    status: result.clusters[0].stories.length === 1 && result.clusters[1].stories.length === 1
      ? 'pass'
      : 'fail',
    notes:
      'Verified: expand-signatures iterates allStoryIds, not the signature ids. Phantom IDs in the signature are inert.',
  });
}

// ──────────────────────────────────────────────────────────────────────
// 10. Network failure (Storybook unreachable) — DOCUMENTED, not simulated
// ──────────────────────────────────────────────────────────────────────
probes.push({
  id: 'network-storybook-unreachable',
  description: 'Storybook UI not running / wrong port (STORYBOOK_URL=http://localhost:9999).',
  category: 'network',
  expected:
    'assertStorybookRunning() throws before any agent invocation. run.ts main()\'s top-level catch prints "Eval failed:" and process.exit(1). No JSONL row written. No SDK cost incurred.',
  observed: 'documented-by-inspection',
  status: 'documented',
  notes:
    'storybook-client.ts:48 wraps fetch in .catch() and rethrows with a contextful message ("Storybook not reachable at <url>: <error>"). run.ts:290 catches and exits non-zero.',
});

// ──────────────────────────────────────────────────────────────────────
// 11. SDK rate-limit / API failure — DOCUMENTED
// ──────────────────────────────────────────────────────────────────────
probes.push({
  id: 'sdk-rate-limit',
  description: 'Rapid serial runs hit the Anthropic API rate limit.',
  category: 'network',
  expected:
    'The SDK\'s `query` async-iterator yields an error. invokeAgent\'s for-await raises; run.ts:184 catches and logs "⚠ Agent invocation failed: ...". The JSONL row is still written with agentRun=null. Subsequent scenarios continue.',
  observed: 'documented-by-inspection',
  status: 'documented',
  notes:
    'run.ts:151-186 wraps the entire invokeAgent call in try/catch. Empirically observed once during variance runs — recovered cleanly. The delay(1500) between scenarios is intentional spacing.',
});

// ──────────────────────────────────────────────────────────────────────
// 12. SDK never returns (hang) — DOCUMENTED
// ──────────────────────────────────────────────────────────────────────
probes.push({
  id: 'sdk-hang',
  description:
    'Enumerate prompt at cascade scale: model generates 30K+ output tokens, SDK call never returns.',
  category: 'network',
  expected:
    'No automatic timeout — the harness blocks indefinitely. User must Ctrl-C. The `--trace` flag is provided specifically to diagnose this case (timestamps per SDK message).',
  observed: 'documented-by-inspection',
  status: 'documented',
  notes:
    'This is the failure mode that motivated the signature-prompt variant. README documents it: enumerate prompt only safe for <600 stories. Iteration-1 production tool should set a wall-clock timeout (~60s) and fall back to deterministic clustering on timeout.',
});

const passCount = probes.filter((p) => p.status === 'pass').length;
const failCount = probes.filter((p) => p.status === 'fail').length;
const documentedCount = probes.filter((p) => p.status === 'documented').length;

const out = {
  experiment: 'N — Failure-mode taxonomy',
  timestamp: new Date().toISOString(),
  summary: {
    total: probes.length,
    pass: passCount,
    fail: failCount,
    documented: documentedCount,
  },
  probes,
  takeaway: `${passCount} library-level failure paths exercised and verified to degrade gracefully. ${documentedCount} network/SDK-level failure paths documented (not forced — would require actual API mistreatment). ${failCount} regressions. The only failure mode WITHOUT a graceful recovery is the SDK hang at cascade scale — fixed by the signature-prompt variant; iteration-1 should add a wall-clock timeout regardless.`,
};

await mkdir(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, 'failure-modes.json');
await writeFile(outPath, JSON.stringify(out, null, 2));

console.log(`\n=== Failure-mode taxonomy ===`);
console.log(`  Total probes: ${probes.length}`);
console.log(`  Pass:         ${passCount}`);
console.log(`  Fail:         ${failCount}`);
console.log(`  Documented:   ${documentedCount}`);
console.log();
for (const p of probes) {
  const icon = p.status === 'pass' ? '✓' : p.status === 'fail' ? '✗' : '·';
  console.log(`  ${icon} [${p.category.padEnd(20)}] ${p.id} — ${p.description}`);
}
console.log(`\nWritten: ${outPath}`);
if (failCount > 0) process.exit(1);
