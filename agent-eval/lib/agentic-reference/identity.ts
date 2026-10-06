// Identity is read from a run's own artifacts, not the harness's fingerprint:
// the fingerprint hashes the sample size and the whole fixture, so a top-up
// of the same measurement never matches it. This holds only what decides the
// outcome, one field per run, so two samples that differ say how.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { AGENTIC_REF_CASES } from './cases.ts';
import { EVALS_DIR, EXPERIMENT_NAME_PREFIX } from './constants.ts';
import { AGENT_CONFIG, providerOf } from './experiment.ts';
import { parseExternalRepoFromManifest } from './external-repo.ts';
import { readJson } from '../utils/files.ts';
import { isRecord } from '../utils/type.ts';

import type { ExternalRepoPin } from './external-repo.ts';

/** Everything that decides what a run measured. */
export interface Measurement {
  /** Experiment name, i.e. results/<experiment>. */
  experiment: string;
  evalName: string;
  /** Model id, e.g. `opus`. */
  model: string;
  /** Upstream tree, as `<repo>@<label>`; bundled refs share a label. */
  pin: string;
  /** Design-system MCP served: `none`, a URL, or `<repo>#<branch>`. */
  mcp: string;
  /** Whether the experiment rewrote the fixture's prompt. */
  editedPrompt: boolean;
  /**
   * How the run's LLM traffic was served (`ai-gateway`, `anthropic`,
   * `openai`), from `result.analysis.provider`; `unknown` on historical runs
   * which were all ai-gateway.
   */
  provider: string;
  /** Digest of the task: the fixture's PROMPT.md and EVAL.ts. */
  task: string;
}

/**
 * External-repo refs naming one upstream tree; their runs aggregate as one
 * sample. Refs match with or without the `refs/tags/agentic-reference/` prefix.
 */
export const BUNDLED_PINS: ReadonlyArray<{
  repo: string;
  /** The name the bundle's refs are reported under. */
  label: string;
  refs: readonly string[];
}> = [
  {
    repo: 'yannbf/mealdrop',
    label: 'droppy-70pc',
    // v4 re-tagged the tree v2 already pointed at; the two collections are one
    // sample.
    refs: ['droppy-70pc-v2', 'droppy-70pc-v4'],
  },
];

const TAG_PREFIX = 'refs/tags/agentic-reference/';

/** A pin as `<repo>@<label>`, with bundled refs collapsed; `unknown` for none. */
export function canonicalPin(pin: ExternalRepoPin | null): string {
  if (pin === null) {
    return 'unknown';
  }
  const ref = pin.ref.startsWith(TAG_PREFIX) ? pin.ref.slice(TAG_PREFIX.length) : pin.ref;
  const bundle = BUNDLED_PINS.find(
    (candidate) => candidate.repo === pin.repo && candidate.refs.includes(ref)
  );
  return `${pin.repo}@${bundle?.label ?? ref}`;
}

/** Comparison key: equal keys mean the same measurement. */
export function measurementKey(measurement: Measurement): string {
  return [
    measurement.experiment,
    measurement.evalName,
    measurement.model,
    measurement.pin,
    measurement.mcp,
    String(measurement.editedPrompt),
    measurement.provider,
    measurement.task,
  ].join('\0');
}

export interface MeasurementDifference {
  field: keyof Measurement;
  was: string;
  now: string;
}

const COMPARED: Array<keyof Measurement> = [
  'pin',
  'mcp',
  'model',
  'editedPrompt',
  'provider',
  'task',
];

/** Which components moved between two measurements. */
export function measurementDifferences(
  stored: Measurement,
  current: Measurement
): MeasurementDifference[] {
  return COMPARED.filter((field) => stored[field] !== current[field]).map((field) => ({
    field,
    was: String(stored[field]),
    now: String(current[field]),
  }));
}

/** Differences as one line. */
export function describeDifferences(differences: readonly MeasurementDifference[]): string {
  return differences.map(({ field, was, now }) => `${field}: ${was} → ${now}`).join('; ');
}

// --- reading a stored run --------------------------------------------------

function digest(parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** The task digest for a directory holding PROMPT.md and EVAL.ts. */
function taskDigest(dir: string): string {
  return digest(
    ['PROMPT.md', 'EVAL.ts'].map((name) => {
      const path = join(dir, name);
      return existsSync(path) ? readFileSync(path, 'utf8') : '';
    })
  );
}

/** A configured model tier as it appears in a run's result.json. */
function modelOf(model: string | readonly string[] | undefined): string {
  if (Array.isArray(model)) {
    return model.join(',');
  }
  return typeof model === 'string' ? model : 'unknown';
}

/** How an MCP spec reads in a measurement. */
function mcpOf(mcpPackage: unknown, mcpUrl: unknown, integration: unknown): string {
  if (isRecord(mcpPackage) && typeof mcpPackage.repo === 'string') {
    const { branch, sha } = mcpPackage;
    const at = typeof branch === 'string' ? branch : typeof sha === 'string' ? sha : 'head';
    return `${mcpPackage.repo}#${at}`;
  }
  if (typeof mcpUrl === 'string') {
    return mcpUrl;
  }
  return integration === 'mcp' ? 'mcp (unrecorded)' : 'none';
}

/**
 * What a stored run measured, or null when its result.json is unreadable. The
 * task is digested from the fixture copy the run was given, not from evals/.
 */
export function readRunMeasurement(
  runDir: string,
  cell: { experiment: string; evalName: string }
): Measurement | null {
  const result = readJson<Record<string, unknown>>(join(runDir, 'result.json'));
  if (result === null) {
    return null;
  }
  const analysis = isRecord(result.analysis) ? result.analysis : {};
  const storedCase = isRecord(analysis.case) ? analysis.case : {};
  let pin: ExternalRepoPin | null = null;
  if (isRecord(analysis.externalRepo)) {
    const { repo, ref } = analysis.externalRepo;
    pin = typeof repo === 'string' && typeof ref === 'string' ? { repo, ref } : null;
  }

  return {
    experiment: cell.experiment,
    evalName: cell.evalName,
    model: typeof result.model === 'string' ? result.model : 'unknown',
    pin: canonicalPin(pin),
    mcp: mcpOf(storedCase.storybookMcpPackage, storedCase.storybookMcpUrl, storedCase.integration),
    editedPrompt: storedCase.editPrompt === true,
    provider: typeof analysis.provider === 'string' ? analysis.provider : 'unknown',
    task: taskDigest(join(runDir, 'project')),
  };
}

// --- what a cell measures today --------------------------------------------

/** What this experiment and eval measure as they stand, or null when either is gone. */
export function currentMeasurement(experiment: string, evalName: string): Measurement | null {
  const agenticRefCase = AGENTIC_REF_CASES.find(
    (candidate) => `${EXPERIMENT_NAME_PREFIX}${candidate.name}` === experiment
  );
  const fixture = join(EVALS_DIR, evalName);
  if (agenticRefCase === undefined || !existsSync(fixture)) {
    return null;
  }

  let pin: ExternalRepoPin | null = null;
  try {
    pin = parseExternalRepoFromManifest(readFileSync(join(fixture, 'package.json'), 'utf8'));
  } catch {
    pin = null;
  }

  const agentConfig = AGENT_CONFIG[agenticRefCase.agent ?? 'claude-code'];

  return {
    experiment,
    evalName,
    model: modelOf(agentConfig.model),
    pin: canonicalPin(pin),
    mcp: mcpOf(
      agenticRefCase.storybookMcpPackage,
      agenticRefCase.storybookMcpUrl,
      agenticRefCase.integration ??
        ((agenticRefCase.storybookMcpPackage ?? agenticRefCase.storybookMcpUrl) ? 'mcp' : 'none')
    ),
    editedPrompt: agenticRefCase.editPrompt !== undefined,
    provider: providerOf(agenticRefCase.overrides?.agent ?? agentConfig.agent),
    task: taskDigest(fixture),
  };
}
