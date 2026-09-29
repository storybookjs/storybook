import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const agentEvalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resultsRoot = join(agentEvalRoot, 'results');
const TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listDirectories(path) {
  if (!existsSync(path)) {
    return [];
  }

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Results are laid out as <experiment path>/<timestamp>/<eval>/summary.json,
// where the experiment path may be nested (e.g. cc-plugin/native-default).
function findTimestampDirectories(dir = resultsRoot) {
  return listDirectories(dir).flatMap((name) => {
    const path = join(dir, name);

    return TIMESTAMP_DIR.test(name) ? [path] : findTimestampDirectories(path);
  });
}

// Usage is computed by the experiments' onRunComplete hook (lib/usage.ts)
// and persisted in each run's result.json as metadata.usage.
function collectEvalUsage(evalRoot) {
  const runs = listDirectories(evalRoot).filter((name) => /^run-\d+$/.test(name));
  const combined = { total: 0, cost: 0, costKnown: true };
  const found = runs.flatMap((run) => {
    const resultPath = join(evalRoot, run, 'result.json');
    const usage = existsSync(resultPath) ? readJson(resultPath).metadata?.usage : undefined;

    return usage ? [usage] : [];
  });

  if (found.length === 0) {
    return null;
  }

  for (const usage of found) {
    combined.total += usage.totalTokens;

    if (usage.estimatedCostUsd === undefined) {
      combined.costKnown = false;
    } else {
      combined.cost += usage.estimatedCostUsd;
    }
  }

  return combined;
}

function formatTokens(count) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  return count >= 1_000 ? `${Math.round(count / 1_000)}k` : `${count}`;
}

function formatCost(usage) {
  if (!usage.costKnown && usage.cost === 0) {
    return '—';
  }

  return `${usage.costKnown ? '' : '≥'}$${usage.cost.toFixed(2)}`;
}

function collectEvals(runRoot) {
  return listDirectories(runRoot).flatMap((name) => {
    const summaryPath = join(runRoot, name, 'summary.json');

    if (!existsSync(summaryPath)) {
      return [];
    }

    const classificationPath = join(runRoot, name, 'classification.json');

    return [
      {
        name,
        summary: readJson(summaryPath),
        classification: existsSync(classificationPath) ? readJson(classificationPath) : null,
        usage: collectEvalUsage(join(runRoot, name)),
      },
    ];
  });
}

function collectExperiments() {
  const latestRunByExperiment = new Map();

  for (const runRoot of findTimestampDirectories()) {
    const experiment = relative(resultsRoot, dirname(runRoot)).split(sep).join('/');
    const previous = latestRunByExperiment.get(experiment);

    // Timestamps are ISO-based, so lexicographic comparison finds the latest run.
    if (!previous || runRoot > previous) {
      latestRunByExperiment.set(experiment, runRoot);
    }
  }

  return [...latestRunByExperiment.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([experiment, runRoot]) => ({
      experiment,
      timestamp: relative(dirname(runRoot), runRoot),
      evals: collectEvals(runRoot),
    }));
}

// Classifier output is free-form: strip newlines, pipes, and backticks so a
// reason can never break out of its markdown table cell.
function sanitizeCell(value) {
  return String(value ?? '')
    .replaceAll(/\s+/g, ' ')
    .replaceAll('|', '\\|')
    .replaceAll('`', "'")
    .trim();
}

function renderEvalRow({ name, summary, classification, usage }) {
  const passed = summary.passedRuns === summary.totalRuns;
  const status = passed ? '✅' : '❌';
  const duration =
    typeof summary.meanDuration === 'number' ? `${summary.meanDuration.toFixed(1)}s` : '—';
  const tokens = usage ? formatTokens(usage.total) : '—';
  const cost = usage ? formatCost(usage) : '—';
  const failure = classification
    ? `\`${sanitizeCell(classification.failureType)}\` — ${sanitizeCell(classification.failureReason)}`
    : '';

  return `| ${status} | \`${name}\` | ${summary.passedRuns}/${summary.totalRuns} (${summary.passRate}) | ${duration} | ${tokens} | ${cost} | ${failure} |`;
}

function renderExperiment({ experiment, timestamp, evals }) {
  if (evals.length === 0) {
    return `#### \`${experiment}\`\n\n_No results._`;
  }

  return [
    `#### \`${experiment}\` (${timestamp})`,
    '',
    '| | Eval | Pass rate | Mean duration | Tokens | Cost | Failure |',
    '|---|---|---|---|---|---|---|',
    ...evals.map(renderEvalRow),
  ].join('\n');
}

const experiments = collectExperiments();
const evals = experiments.flatMap(({ evals: experimentEvals }) => experimentEvals);
const passedEvals = evals.filter(({ summary }) => summary.passedRuns === summary.totalRuns);
const totals = evals
  .map(({ usage }) => usage)
  .filter(Boolean)
  .reduce(
    (acc, usage) => ({
      total: acc.total + usage.total,
      cost: acc.cost + usage.cost,
      costKnown: acc.costKnown && usage.costKnown,
    }),
    { total: 0, cost: 0, costKnown: true }
  );
const playgroundUrl = process.env.PLAYGROUND_URL;
const runUrl = process.env.RUN_URL;

const sections = [
  [
    '### Agent eval results',
    '',
    `**${passedEvals.length}/${evals.length} evals passed**${
      totals.total > 0 ? ` · ${formatTokens(totals.total)} tokens · ${formatCost(totals)}` : ''
    }${runUrl ? ` ([workflow run](${runUrl}))` : ''}`,
  ].join('\n'),
];

if (playgroundUrl) {
  sections.push(`Playground: ${playgroundUrl}`);
}

if (experiments.length > 0) {
  sections.push(
    [
      '<details>',
      '<summary>Results by experiment</summary>',
      '',
      experiments.map(renderExperiment).join('\n\n'),
      '',
      '</details>',
    ].join('\n')
  );
  sections.push(
    '_Cost is estimated from model token usage at provider list prices ([Vercel AI Gateway](https://vercel.com/docs/ai-gateway/pricing) adds no markup) and excludes Vercel Sandbox compute._'
  );
}

process.stdout.write(`${sections.join('\n\n')}\n`);
