/**
 * Inner-loop agent eval — runs synthetic edits against a live Storybook UI,
 * captures the deterministic change-detection baseline, builds the proposed
 * `get_change_context` payload, optionally invokes Claude, scores the
 * clustering output, and writes a JSONL row to results/.
 *
 * This file is the inner-loop counterpart to scripts/eval/eval.ts (which
 * grades story-writing benchmarks). It re-uses the same `@anthropic-ai/claude-agent-sdk`
 * subscription-based auth path (no ANTHROPIC_API_KEY needed if you have
 * Claude Code installed locally).
 *
 * Usage:
 *   yarn ts-node scripts/eval/inner-loop/run.ts [flags]
 *   # or, since the repo runs Node 22+ natively for .ts:
 *   node --experimental-transform-types --no-warnings scripts/eval/inner-loop/run.ts [flags]
 *
 * Flags:
 *   --scenario <name>   Run only the named scenario (default: all)
 *   --baseline-only     Skip agent invocation; just measure tokens
 *   --runs <N>          Repeat each scenario N times (default 1)
 *   --no-cleanup        Don't revert edits at end (for debugging)
 *   --verbose           Stream agent messages to stdout
 *   --model <id>        Override SDK model (default: claude-sonnet-4-6)
 *   --effort <level>    low|medium|high|max (default: medium)
 *
 * Prerequisites:
 *   1. Storybook UI running on http://localhost:6006 with addon-before-after.
 *   2. (Recommended) The status-probe Vite middleware patch applied to
 *      addon-before-after — see project-documents/questions/appendix/patches/.
 *      Without it, the harness falls back to a manual DevTools probe.
 */
import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, findScenario, type Scenario } from './scenarios.ts';
import { applyEdit, revertEdit, getRawDiff } from './lib/edit-fixture.ts';
import {
  assertStorybookRunning,
  pollChangeDetection,
  waitForEmptyBaseline,
  DEVTOOLS_PROBE_SNIPPET,
  type CdStatus,
  type StoryIndex,
} from './lib/storybook-client.ts';
import { buildPayload, buildStoryToFile } from './lib/build-payload.ts';
import { estimateTokens } from './lib/estimate-tokens.ts';
import { invokeAgent } from './lib/invoke-agent.ts';
import { score } from './lib/score.ts';
import { scoreSignatureQuality } from './lib/signature-quality.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();
const RESULTS_DIR = join(HERE, 'results');

interface Args {
  scenario?: string;
  baselineOnly: boolean;
  runs: number;
  noCleanup: boolean;
  verbose: boolean;
  trace: boolean;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  prompt?: 'enumerate' | 'signature' | 'signature-depth';
  outFile?: string;
  withDepth: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    baselineOnly: false,
    runs: 1,
    noCleanup: false,
    verbose: false,
    trace: false,
    withDepth: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--baseline-only') args.baselineOnly = true;
    else if (a === '--runs') args.runs = Number(argv[++i] || '1');
    else if (a === '--no-cleanup') args.noCleanup = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--trace') args.trace = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--effort') args.effort = argv[++i] as Args['effort'];
    else if (a === '--prompt') args.prompt = argv[++i] as Args['prompt'];
    else if (a === '--out') args.outFile = argv[++i];
    else if (a === '--with-depth') args.withDepth = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Run scripts/eval/inner-loop/run.ts. See README.md.`);
      process.exit(0);
    }
  }
  return args;
}

async function runScenario(
  scenario: Scenario,
  args: Args,
  index: StoryIndex
): Promise<unknown> {
  console.log(`\n━━━ ${scenario.name} ━━━`);
  console.log(`  Edit: ${scenario.filePath}`);
  console.log(`  Hypothesis: ${scenario.hypothesis}`);

  // Make sure the previous scenario's change-detection scan has fully
  // drained before we apply this scenario's edit. Without this, rapid
  // serial scenarios race against the dogfood's slow scan cycles.
  await waitForEmptyBaseline();

  await applyEdit(scenario);
  console.log(`  ✓ Edit applied`);

  let statuses: CdStatus[] = [];
  try {
    const expectEmpty =
      scenario.name === 'css-only' || scenario.name === 'regex-aliased';
    statuses = await pollChangeDetection({ expectEmpty });
    if (statuses.length === 0) {
      console.log(`  ⚠ No change-detection probe data. Run this in Storybook DevTools console:`);
      console.log(`\n${DEVTOOLS_PROBE_SNIPPET}\n`);
      console.log(`  Save the JSON to /tmp/sb-cd-statuses.json and re-run this scenario.`);
    }
  } catch (e) {
    console.log(`  ⚠ Failed to read statuses: ${(e as Error).message}`);
  }

  const rawDiff = await getRawDiff(scenario);

  // Round-2 §I.5: optionally load precomputed depth map.
  let depthByStory: Record<string, number> | undefined;
  if (args.withDepth && statuses.length > 0) {
    try {
      const text = await readFile(
        join(HERE, 'results', 'depth-maps', `${scenario.name}.json`),
        'utf8'
      );
      const parsed = JSON.parse(text) as { byStoryId?: Record<string, number> };
      depthByStory = parsed.byStoryId ?? {};
      const ds = Object.values(depthByStory);
      console.log(
        `  Depth map: ${ds.length} stories, depth min=${ds.length ? Math.min(...ds) : 0} max=${ds.length ? Math.max(...ds) : 0} (precomputed)`
      );
    } catch (e) {
      console.log(`  ⚠ Depth map missing — run precompute-depth-maps.ts. (${(e as Error).message})`);
    }
  }

  const payload = buildPayload({ statuses, rawDiff, scenario, index, depthByStory });
  const payloadJson = JSON.stringify(payload);
  const estimatedTokens = estimateTokens(payloadJson);

  console.log(
    `  Statuses: ${statuses.length} (modified=${payload.modified.length}, affected=${payload.affected.length})`
  );
  console.log(`  Payload: ${payloadJson.length} chars / ~${estimatedTokens} tokens`);

  let agentRun:
    | Awaited<ReturnType<typeof invokeAgent>>
    | null = null;
  let scores: ReturnType<typeof score> | null = null;
  if (!args.baselineOnly && statuses.length > 0) {
    try {
      const promptVariant = args.prompt || 'enumerate';
      console.log(
        `  Invoking Claude (model=${args.model || 'claude-sonnet-4-6'} effort=${args.effort || 'medium'} prompt=${promptVariant})...`
      );
      agentRun = await invokeAgent(payload, {
        sdkModel: args.model,
        effort: args.effort,
        verbose: args.verbose,
        trace: args.trace,
        promptVariant,
      });
      console.log(
        `  Agent: turns=${agentRun.turns}, durationS=${Math.round(agentRun.durationS)}, cost=$${agentRun.costUsd ?? '?'}`
      );
      if (agentRun.parsed) {
        scores = score(payload, agentRun.parsed.clusters);
        console.log(
          `  Scores: recall=${scores.recall} precision=${scores.precision} purity=${scores.clusterPurity} clusters=${agentRun.parsed.clusters.length}`
        );
        const _pv = args.prompt || 'enumerate';
        if (_pv === 'signature' || _pv === 'signature-depth') {
          const sq = scoreSignatureQuality(
            'signature',
            agentRun.rawSignatureClusters,
            agentRun.parsed.clusters
          );
          console.log(
            `  Signature quality: catchAll=${(sq.catchAllShare * 100).toFixed(1)}% reprValid=${sq.representativeValidCount}/${sq.representativeTotalCount} avgPrefix=${sq.avgPrefixLength ?? '-'} avgRegex=${sq.avgRegexLength ?? '-'} shadowed=${sq.shadowedClusterCount}`
          );
        }
      } else {
        console.log(`  ⚠ Agent output failed to parse: ${agentRun.parseError}`);
      }
    } catch (e) {
      console.log(`  ⚠ Agent invocation failed: ${(e as Error).message}`);
    }
  }

  if (!args.noCleanup) {
    await revertEdit(scenario);
    console.log(`  ✓ Edit reverted`);
  }

  return {
    timestamp: new Date().toISOString(),
    scenario: scenario.name,
    description: scenario.description,
    edit: { path: scenario.filePath },
    rawDiff,
    groundTruth: {
      modified: payload.modified.length,
      affected: payload.affected.length,
      new: payload.new.length,
      total: statuses.length,
      withinExpectedRange:
        statuses.length >= scenario.expectedCascade.min &&
        statuses.length <= scenario.expectedCascade.max,
    },
    payload: {
      totalSizeBytes: payloadJson.length,
      estimatedTokens,
      modified: payload.modified,
      affected: payload.affected,
      newStories: payload.new,
      cssAffected: payload.cssAffected,
      projectShape: payload.projectShape,
      // Persisted for the HTML report's file-level graph view, NOT sent
      // to the agent (avoids inflating its input tokens by O(N stories)).
      storyToFile: buildStoryToFile(payload, index),
    },
    agentRun: agentRun
      ? {
          model: agentRun.model,
          promptVariant: args.prompt || 'enumerate',
          effort: args.effort || 'medium',
          turns: agentRun.turns,
          costUsd: agentRun.costUsd,
          durationS: agentRun.durationS,
          durationApiS: agentRun.durationApiS,
          inputTokens: agentRun.inputTokens,
          outputTokens: agentRun.outputTokens,
          cacheReadTokens: agentRun.cacheReadTokens,
          messageTrace: agentRun.messageTrace,
          rawOutput: agentRun.raw,
          clusterCount: agentRun.parsed?.clusters?.length ?? 0,
          clusters: agentRun.parsed?.clusters?.map((c) => ({
            id: c.id,
            rationale: c.rationale,
            representative: c.representative,
            storyCount: c.stories.length,
            stories: c.stories,
          })),
          rawSignatureClusters: agentRun.rawSignatureClusters,
          parseError: agentRun.parseError,
          sessionId: agentRun.sessionId,
          transcript: agentRun.transcript,
        }
      : null,
    scores,
    signatureQuality:
      agentRun?.parsed && (args.prompt || 'enumerate') === 'signature'
        ? scoreSignatureQuality(
            'signature',
            agentRun.rawSignatureClusters,
            agentRun.parsed.clusters
          )
        : null,
  };
}

async function main() {
  const args = parseArgs();
  const index = await assertStorybookRunning();
  console.log(`Storybook UI is up — ${Object.keys(index.entries).length} stories indexed`);

  const scenarios = args.scenario
    ? ([findScenario(args.scenario)].filter(Boolean) as Scenario[])
    : SCENARIOS;
  if (args.scenario && scenarios.length === 0) {
    throw new Error(`Scenario "${args.scenario}" not found`);
  }

  await mkdir(RESULTS_DIR, { recursive: true });
  const filename =
    args.outFile || `run-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  const outPath = join(RESULTS_DIR, filename);

  for (const scenario of scenarios) {
    for (let r = 0; r < args.runs; r++) {
      const result = await runScenario(scenario, args, index);
      await appendFile(
        outPath,
        JSON.stringify({ ...result, runIndex: r, runsTotal: args.runs }) + '\n'
      );
      await delay(1500);
    }
  }

  console.log(`\nResults: ${outPath}`);
}

main().catch((e) => {
  console.error('Eval failed:', e);
  process.exit(1);
});
