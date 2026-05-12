/**
 * Simulate the agent workflow as it would actually happen with the
 * shipped MCP surface (storybookjs/mcp PR #219):
 *
 *   1. Agent calls `get-changed-stories` and gets MARKDOWN TEXT (not the
 *      structured payload our existing eval sends).
 *   2. Agent assembles raw `git diff` via filesystem tools (we provide
 *      it here directly to keep the test bounded).
 *   3. Agent reasons over both, emits cluster signatures.
 *
 * Compare to the existing `signature` and `signature-depth` eval runs:
 * does the same prompt produce the same cluster quality when fed the
 * shipped tool's text-only output instead of structured JSON?
 *
 * Output: scripts/eval/inner-loop/results/exp-mcp-<scenario>.jsonl
 */
import { mkdir, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, findScenario } from './scenarios.ts';
import { applyEdit, revertEdit, getRawDiff } from './lib/edit-fixture.ts';
import {
  assertStorybookRunning,
  pollChangeDetection,
  waitForEmptyBaseline,
  type CdStatus,
  type StoryIndex,
} from './lib/storybook-client.ts';
import { invokeAgent } from './lib/invoke-agent.ts';
import { score, type Cluster } from './lib/score.ts';
import { scoreSignatureQuality } from './lib/signature-quality.ts';
import { expandSignatures, type SignatureCluster } from './lib/expand-signatures.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');

interface Args {
  scenario: string;
  effort: 'low' | 'medium' | 'high' | 'max';
  model: string;
  outFile?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { scenario: 'medium', effort: 'low', model: 'claude-sonnet-4-6' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--effort') args.effort = argv[++i] as Args['effort'];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--out') args.outFile = argv[++i];
  }
  return args;
}

/**
 * Mirror the EXACT output format of the shipped `get-changed-stories`
 * tool — see https://github.com/storybookjs/mcp/blob/d4c7876/packages/addon-mcp/src/tools/get-changed-stories.ts
 *
 * Returns:
 *   Detected N changed stor(y|ies) (X new, Y modified, Z related).
 *
 *   New stories:
 *   - `<id>`: <title> / <name> (`<importPath>`)
 *   Modified stories:
 *   - `<id>`: <title> / <name> (`<importPath>`)
 *   Related stories:
 *   - `<id>`: <title> / <name> (`<importPath>`)
 *
 * Sorted by status priority (new=0, modified=1, related=2) then storyId.
 */
function simulateGetChangedStories(statuses: CdStatus[], index: StoryIndex): string {
  const enriched = statuses
    .map((s) => {
      const entry = index.entries[s.storyId];
      if (!entry) return null;
      return {
        storyId: s.storyId,
        statusValue: s.value,
        title: entry.title,
        name: entry.name,
        importPath: entry.importPath,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const priorityOf = (v: CdStatus['value']) =>
    v === 'status-value:new' ? 0 : v === 'status-value:modified' ? 1 : 2;

  enriched.sort((a, b) => {
    const d = priorityOf(a.statusValue) - priorityOf(b.statusValue);
    return d !== 0 ? d : a.storyId.localeCompare(b.storyId);
  });

  const byBucket = {
    new: enriched.filter((s) => s.statusValue === 'status-value:new'),
    modified: enriched.filter((s) => s.statusValue === 'status-value:modified'),
    related: enriched.filter((s) => s.statusValue === 'status-value:affected'),
  };

  const totalNice = enriched.length === 1 ? 'story' : 'ies';
  const total = enriched.length === 1 ? 'y' : totalNice;
  let text = `Detected ${enriched.length} changed stor${total} (${byBucket.new.length} new, ${byBucket.modified.length} modified, ${byBucket.related.length} related).`;

  const serialize = (s: { storyId: string; title: string; name: string; importPath: string }) =>
    `- \`${s.storyId}\`: ${s.title} / ${s.name} (\`${s.importPath}\`)`;

  if (byBucket.new.length > 0) {
    text += `\n\nNew stories:\n` + byBucket.new.map(serialize).join('\n');
  }
  if (byBucket.modified.length > 0) {
    text += `\n\nModified stories:\n` + byBucket.modified.map(serialize).join('\n');
  }
  if (byBucket.related.length > 0) {
    text += `\n\nRelated stories:\n` + byBucket.related.map(serialize).join('\n');
  }
  return text;
}

const args = parseArgs();
const scenario = findScenario(args.scenario);
if (!scenario) {
  console.error(`Unknown scenario: ${args.scenario}`);
  process.exit(1);
}

console.log(`Asserting Storybook UI is up…`);
const index = await assertStorybookRunning();
console.log(`Index: ${Object.keys(index.entries).length} stories.`);

console.log(`\n━━━ ${scenario.name} (MCP workflow simulation) ━━━`);
console.log(`  Edit: ${scenario.filePath}`);

await waitForEmptyBaseline();
await applyEdit(scenario);
console.log(`  ✓ Edit applied`);

let statuses: CdStatus[] = [];
try {
  statuses = await pollChangeDetection({ expectEmpty: false });
} catch (e) {
  console.log(`  ⚠ Failed to read statuses: ${(e as Error).message}`);
}
console.log(`  Statuses: ${statuses.length}`);

const rawDiff = await getRawDiff(scenario);
const changedStoriesText = simulateGetChangedStories(statuses, index);

console.log(`\n=== Simulated get-changed-stories output ===`);
console.log(changedStoriesText.split('\n').slice(0, 8).join('\n'));
console.log(`  …(${changedStoriesText.split('\n').length} lines total, ${changedStoriesText.length} chars)`);

// Build the user message the agent would assemble in real-world MCP use:
//   - the markdown output from get-changed-stories
//   - the raw diff (agent fetched via filesystem)
const userMessage = `I just edited a file. I called the \`get-changed-stories\` tool and got this output:

${changedStoriesText}

Here is the git diff for the edited file (I obtained this via my filesystem tools):

\`\`\`diff
${rawDiff}
\`\`\`

Categorise these stories into cluster signatures so I know where to focus my review.`;

console.log(`\nUser-message size: ${userMessage.length} chars (~${Math.ceil(userMessage.length / 4)} tokens)`);

// Use the SAME signature prompt as the existing eval — only the input shape
// changes. This isolates the question: "given just the shipped tool's text
// output + raw diff, can the agent still produce useful clusters?"
//
// We re-use invokeAgent's parsing logic by hand-building a minimal payload
// that satisfies the type but actually sends the text-only user message.
//
// Trick: invokeAgent reads payload.modified/.affected/.new/.cssAffected
// for the signature-expansion step. We populate those from the live
// statuses so expansion works, but the agent never sees them — only the
// markdown text we crafted above.

import { readFile } from 'node:fs/promises';
const promptPath = join(HERE, 'prompts', 'categoriser-signature.md');
const systemPrompt = await readFile(promptPath, 'utf8');

const { query } = await import('@anthropic-ai/claude-agent-sdk');
const startTime = Date.now();
let lastAssistantText = '';
let cost: number | undefined;
let turns = 0;
let inputTokens: number | undefined;
let outputTokens: number | undefined;

for await (const message of query({
  prompt: userMessage,
  options: {
    model: args.model,
    allowedTools: [],
    effort: args.effort,
    systemPrompt,
  } as any,
})) {
  if (message.type === 'assistant' && Array.isArray((message as any).message?.content)) {
    for (const block of (message as any).message.content) {
      if (block.type === 'text') lastAssistantText = block.text;
    }
  }
  if (message.type === 'result') {
    const m = message as any;
    cost = m.total_cost_usd;
    turns = m.num_turns ?? 0;
    inputTokens = m.usage?.input_tokens;
    outputTokens = m.usage?.output_tokens;
  }
}

const durationS = (Date.now() - startTime) / 1000;
console.log(`\n  Agent: turns=${turns}, durationS=${Math.round(durationS)}, cost=$${cost ?? '?'}`);
console.log(`  Tokens: input=${inputTokens ?? '?'} output=${outputTokens ?? '?'}`);

// Parse + expand signatures
let parsed: { clusters: Cluster[] } | null = null;
let parseError: string | undefined;
let rawSignatureClusters: SignatureCluster[] | undefined;
try {
  const cleaned = lastAssistantText
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();
  const raw = JSON.parse(cleaned) as { clusters: SignatureCluster[] };
  rawSignatureClusters = raw.clusters;
  const modified = statuses.filter((s) => s.value === 'status-value:modified').map((s) => s.storyId);
  const affected = statuses.filter((s) => s.value === 'status-value:affected').map((s) => s.storyId);
  const newSet = statuses.filter((s) => s.value === 'status-value:new').map((s) => s.storyId);
  const allIds = [...modified, ...affected, ...newSet];
  const expansion = expandSignatures(rawSignatureClusters, allIds);
  parsed = { clusters: expansion.clusters };
  // Construct a minimal payload for scoring.
  const fakePayload = {
    modified,
    affected,
    new: newSet,
    cssAffected: [] as string[],
    rawDiff: [{ path: scenario.filePath, hunks: rawDiff }],
    projectShape: { totalStories: 0, topNamespaces: [] },
    reverseIndexSlice: [],
  };
  const scores = score(fakePayload as any, parsed.clusters);
  const sq = scoreSignatureQuality('signature', rawSignatureClusters, parsed.clusters);
  console.log(
    `  Scores: recall=${scores.recall} precision=${scores.precision} purity=${scores.clusterPurity} clusters=${parsed.clusters.length}`
  );
  console.log(
    `  Signature quality: catchAll=${(sq.catchAllShare * 100).toFixed(1)}% reprValid=${sq.representativeValidCount}/${sq.representativeTotalCount}`
  );

  await mkdir(RESULTS_DIR, { recursive: true });
  const outName = args.outFile || `exp-mcp-${scenario.name}.jsonl`;
  const outPath = join(RESULTS_DIR, outName);
  await appendFile(
    outPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      scenario: scenario.name,
      mcpWorkflow: true,
      simulatedGetChangedStoriesChars: changedStoriesText.length,
      userMessageChars: userMessage.length,
      groundTruth: {
        modified: modified.length,
        affected: affected.length,
        new: newSet.length,
        total: statuses.length,
      },
      agentRun: {
        model: args.model,
        effort: args.effort,
        turns,
        costUsd: cost,
        durationS,
        inputTokens,
        outputTokens,
        rawOutput: lastAssistantText,
        clusters: parsed.clusters.map((c) => ({
          id: c.id,
          rationale: c.rationale,
          representative: c.representative,
          storyCount: c.stories.length,
          stories: c.stories,
        })),
        rawSignatureClusters,
      },
      scores,
      signatureQuality: sq,
    }) + '\n'
  );
  console.log(`\nResults: ${outPath}`);
} catch (e) {
  parseError = e instanceof Error ? e.message : String(e);
  console.error(`  ⚠ Parse error: ${parseError}`);
  console.error(`  Raw output:\n${lastAssistantText}`);
}

await revertEdit(scenario);
console.log(`  ✓ Edit reverted`);

await delay(500);
process.exit(parseError ? 1 : 0);
