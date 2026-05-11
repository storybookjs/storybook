// Entry script for the PR verify harness recipe-author generator.
// Usage: bun scripts/verify-pr-generate.ts --pr <number> [--force]
//
// Responsibility: deterministic I/O + prompt-bundle emission ONLY.
// This script does NOT dispatch an agent, does NOT write a final spec,
// and does NOT lint. The `verify-recipe-author` skill (Lane C) consumes
// the emitted prompt bundle and performs those steps under human review.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

import { buildRunPaths, ensureRunDir, pruneOldRuns } from './verify/core.ts';
import { buildRecipeAuthorPrompt } from './verify/agent-prompt.ts';
import type {
  PromptInput,
  PromptPRFile,
  PromptPRMeta,
  PromptReferenceSpec,
} from './verify/agent-prompt.ts';
import { matchedTriageGlobs, triageReferenceSpecs } from './verify/triage.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const RECIPES_DIR = path.resolve(repoRoot, '.verify-recipes');
const AUTHORING_GUIDE_PATH = path.resolve(RECIPES_DIR, '_recipe-authoring-guide.md');
const CANONICAL_SMOKE_PATH = path.resolve(RECIPES_DIR, 'example-smoke.spec.ts');

const REFERENCE_SPEC_HEAD_CAP = 2;
const DIFF_BYTE_CAP = 5 * 1024 * 1024; // 5 MB
const PER_FILE_LINE_CAP = 500;
const TOTAL_FILE_CAP = 20;
const AGENT_MODEL_HINT = 'claude-opus-4-7[1m]';

const HELP = `
Usage: bun scripts/verify-pr-generate.ts --pr <number> [--force]

Options:
  --pr <number>   GitHub PR number to generate a recipe author prompt for (required)
  --force         Allow overwriting an existing .verify-recipes/pr-<#>.spec.ts
  --help          Show this help

Output:
  Writes a prompt bundle to .verify-output/<runId>/prompt-bundle.json and
  prints the next-step command. Does NOT dispatch the agent or write the
  final spec — invoke the verify-recipe-author skill on the bundle path.
`.trim();

interface GhPRMetaRaw {
  title?: string;
  body?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  files?: Array<{ path?: string; additions?: number; deletions?: number }>;
}

interface DiffFile {
  path: string;
  additions: number;
  body: string;
  triageMatched: boolean;
  truncated: boolean;
}

interface PromptBundle {
  version: 1;
  prNumber: number;
  runId: string;
  outputSpecPath: string;
  force: boolean;
  prompt: string;
  metadata: {
    agentModel: string;
    referenceSpecs: string[];
    triageGlobs: string[];
    generatedAt: string;
  };
}

function ghJson(args: string[]): string {
  try {
    return execFileSync('gh', args, {
      cwd: repoRoot,
      encoding: 'utf-8',
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[verify-pr-generate] gh ${args.join(' ')} failed: ${msg}\n` +
        `Hint: ensure the GitHub CLI is installed and authenticated (gh auth login).`
    );
  }
}

function fetchPRMeta(prNumber: number): PromptPRMeta {
  const raw = ghJson([
    'pr',
    'view',
    String(prNumber),
    '--json',
    'title,body,files,additions,deletions,changedFiles',
  ]);
  const parsed = JSON.parse(raw) as GhPRMetaRaw;
  const files: PromptPRFile[] = Array.isArray(parsed.files)
    ? parsed.files.map((f) => ({
        path: String(f.path ?? ''),
        additions: Number(f.additions ?? 0),
        deletions: Number(f.deletions ?? 0),
      }))
    : [];
  return {
    title: String(parsed.title ?? ''),
    body: String(parsed.body ?? ''),
    files,
    additions: Number(parsed.additions ?? 0),
    deletions: Number(parsed.deletions ?? 0),
    changedFiles: Number(parsed.changedFiles ?? files.length),
  };
}

function fetchPRDiff(prNumber: number): string {
  // AC-V3-10: MUST use --patch.
  return ghJson(['pr', 'diff', String(prNumber), '--patch']);
}

/**
 * Split a unified diff into per-file blocks keyed by the `+++ b/<path>`
 * header. Each block includes its `diff --git`/index/`---`/`+++` preamble.
 */
function splitDiffPerFile(rawDiff: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = rawDiff.split('\n');
  let currentPath: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentPath !== null) {
      out.set(currentPath, currentLines.join('\n'));
    }
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flush();
      currentPath = null;
      currentLines = [line];
    } else if (currentLines.length > 0 || line.startsWith('+++ ') || line.startsWith('--- ')) {
      currentLines.push(line);
      if (currentPath === null && line.startsWith('+++ b/')) {
        currentPath = line.slice('+++ b/'.length).trim();
      }
    }
  }
  flush();
  return out;
}

function truncateFileBody(body: string): { body: string; truncated: boolean } {
  const lines = body.split('\n');
  if (lines.length <= PER_FILE_LINE_CAP) {
    return { body, truncated: false };
  }
  const elided = lines.length - PER_FILE_LINE_CAP;
  const head = lines.slice(0, PER_FILE_LINE_CAP);
  head.push(`[...${elided} lines elided]`);
  return { body: head.join('\n'), truncated: true };
}

function buildTruncatedDiff(
  rawDiff: string,
  prFiles: PromptPRFile[],
  triageMatchedPaths: Set<string>
): string {
  if (rawDiff.length > DIFF_BYTE_CAP) {
    throw new Error(
      `[verify-pr-generate] raw PR diff exceeds ${DIFF_BYTE_CAP} bytes (got ${rawDiff.length}). ` +
        `Aborting per D5 / R2. A --commit-range variant is planned for v4.`
    );
  }

  const perFile = splitDiffPerFile(rawDiff);
  const additionsByPath = new Map<string, number>();
  for (const f of prFiles) additionsByPath.set(f.path, f.additions);

  const all: DiffFile[] = [];
  for (const [filePath, body] of perFile) {
    const { body: capped, truncated } = truncateFileBody(body);
    all.push({
      path: filePath,
      additions: additionsByPath.get(filePath) ?? 0,
      body: capped,
      triageMatched: triageMatchedPaths.has(filePath),
      truncated,
    });
  }

  const matched = all
    .filter((f) => f.triageMatched)
    .sort((a, b) => b.additions - a.additions || a.path.localeCompare(b.path));
  const unmatched = all
    .filter((f) => !f.triageMatched)
    .sort((a, b) => b.additions - a.additions || a.path.localeCompare(b.path));

  const ordered = [...matched, ...unmatched];
  const kept = ordered.slice(0, TOTAL_FILE_CAP);
  const elided = ordered.slice(TOTAL_FILE_CAP);

  const parts: string[] = kept.map((f) => f.body);
  if (elided.length > 0) {
    const sample = elided.slice(0, 5).map((f) => f.path);
    const suffix = elided.length > sample.length ? `, +${elided.length - sample.length} more` : '';
    parts.push(`[...${elided.length} files elided: ${sample.join(', ')}${suffix}]`);
    console.error(
      `[verify-pr-generate] diff elided ${elided.length} files (cap ${TOTAL_FILE_CAP}): ` +
        `${sample.join(', ')}${suffix}`
    );
  }

  return parts.join('\n');
}

function readReferenceSpec(absPath: string): PromptReferenceSpec {
  const source = fs.readFileSync(absPath, 'utf-8');
  return { path: path.relative(repoRoot, absPath), source };
}

async function main(argv: string[]): Promise<number> {
  const { values: flags } = parseArgs({
    args: argv,
    options: {
      pr: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  if (!flags.pr) {
    console.error('[verify-pr-generate] --pr <number> is required.\n');
    console.error(HELP);
    return 1;
  }

  const prNumber = Number(flags.pr);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error(`[verify-pr-generate] --pr must be a positive integer, got: ${flags.pr}`);
    return 1;
  }

  const paths = buildRunPaths();
  await pruneOldRuns();
  await ensureRunDir(paths);

  // D9 spec-name collision pre-flight.
  const outputSpecPath = path.resolve(RECIPES_DIR, `pr-${prNumber}.spec.ts`);
  if (fs.existsSync(outputSpecPath) && !flags.force) {
    console.error(
      `[verify] .verify-recipes/pr-${prNumber}.spec.ts already exists. Pass --force to overwrite.`
    );
    return 1;
  }

  console.error(`[verify-pr-generate] fetching PR #${prNumber} metadata via gh ...`);
  const prMeta = fetchPRMeta(prNumber);

  console.error(`[verify-pr-generate] fetching PR #${prNumber} diff via gh pr diff --patch ...`);
  const rawDiff = fetchPRDiff(prNumber);

  const changedPaths = prMeta.files.map((f) => f.path);
  const triageMatched = matchedTriageGlobs(changedPaths);
  const referencePaths = triageReferenceSpecs(changedPaths);

  if (referencePaths.length === 0) {
    console.error('[triage] empty -> canonical smoke only');
  } else {
    console.error(
      `[triage] matched ${triageMatched.length} glob(s); ${referencePaths.length} reference spec(s) resolved`
    );
  }

  const triageMatchedPaths = new Set<string>();
  for (const f of prMeta.files) {
    // Determine triage-matched files for diff ordering: re-run minimatch via the
    // resolver — cheaper to recompute than thread state through.
    if (triageReferenceSpecs([f.path]).length > 0) {
      triageMatchedPaths.add(f.path);
    }
  }
  const truncatedDiff = buildTruncatedDiff(rawDiff, prMeta.files, triageMatchedPaths);

  const authoringGuide = fs.readFileSync(AUTHORING_GUIDE_PATH, 'utf-8');
  const referenceSpecs: PromptReferenceSpec[] = referencePaths
    .slice(0, REFERENCE_SPEC_HEAD_CAP)
    .map(readReferenceSpec);
  const canonicalSmoke = readReferenceSpec(CANONICAL_SMOKE_PATH);

  const promptInput: PromptInput = {
    prNumber,
    prMeta,
    prDiff: truncatedDiff,
    referenceSpecs,
    canonicalSmoke,
    authoringGuide,
  };

  const prompt = buildRecipeAuthorPrompt(promptInput);

  const bundle: PromptBundle = {
    version: 1,
    prNumber,
    runId: paths.runId,
    outputSpecPath,
    force: Boolean(flags.force),
    prompt,
    metadata: {
      agentModel: AGENT_MODEL_HINT,
      referenceSpecs: referenceSpecs.map((r) => r.path),
      triageGlobs: triageMatched,
      generatedAt: new Date().toISOString(),
    },
  };

  const bundlePath = path.resolve(paths.runDir, 'prompt-bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');

  console.log(`[verify-pr-generate] prompt bundle: ${bundlePath}`);
  console.log(
    `[verify-pr-generate] Next: invoke the \`verify-recipe-author\` skill on the bundle path above.`
  );
  console.log(
    `[verify-pr-generate] After review, run: yarn verify-pr --recipe-spec .verify-recipes/pr-${prNumber}.spec.ts`
  );

  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[verify-pr-generate] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
