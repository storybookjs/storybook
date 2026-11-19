#!/usr/bin/env node
// Resolves which eval conditions are on for this workflow run, from the PR labels, the
// workflow_dispatch inputs, or (for scheduled runs) `"schedule": true` in the config.
//
//   node agent-eval/scripts/resolve-conditions.ts --labels <json array> --inputs <json object>
//
// Prints one `<condition id>=1|` line per condition, plus `scope_line` (the labels of the conditions
// that are on), and writes them as step outputs when GITHUB_OUTPUT is set.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

interface Condition {
  id: string;
  label: string;
  input: string;
  description: string;
  schedule?: boolean;
}

interface ConditionsConfig {
  labelPrefix: string;
  optInLabel: string;
  conditions: Condition[];
}

const configFile = join(dirname(dirname(fileURLToPath(import.meta.url))), 'eval-conditions.json');
const config: ConditionsConfig = JSON.parse(readFileSync(configFile, 'utf8'));

const { values } = parseArgs({
  options: {
    labels: { type: 'string', default: '[]' },
    inputs: { type: 'string', default: '{}' },
  },
});
const labels: string[] = JSON.parse(values.labels) ?? [];
const inputs: Record<string, unknown> = JSON.parse(values.inputs) ?? {};
const isScheduled = process.env.GITHUB_EVENT_NAME === 'schedule';

const declared = new Set([config.optInLabel, ...config.conditions.map(({ label }) => label)]);
const unknown = labels.filter(
  (label) => label.startsWith(config.labelPrefix) && !declared.has(label)
);
if (unknown.length > 0) {
  console.log(
    `::warning title=Unknown eval labels::Ignoring labels not declared in agent-eval/eval-conditions.json: ${unknown.join(', ')}`
  );
}

const active = config.conditions.filter(
  (condition) =>
    (isScheduled && condition.schedule === true) ||
    inputs[condition.input] === true ||
    labels.includes(condition.label)
);

const outputs = [
  ...config.conditions.map(
    (condition) => `${condition.id}=${active.includes(condition) ? '1' : ''}`
  ),
  `scope_line=${active.map(({ label }) => label).join(', ')}`,
];
for (const line of outputs) {
  console.log(line);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
  }
}
