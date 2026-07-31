/** Fresh-process execution for one latency repetition. */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { outputTail } from '../docgen-shared/child-output.ts';
import type { LatencyRepetition } from '../docgen-shared/latency-series.ts';

export interface LatencyChildSpec {
  childPath: string;
  args: string[];
  /** Scenario parameters the child must echo after parsing its CLI flags. */
  expectedWorkload: Record<string, number | string | boolean>;
  /** The React OSA source child requires jiti; legacy parser children must remain native. */
  jiti?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childOptionName(scenarioParam: string): string {
  return scenarioParam === 'name' ? 'scenario' : scenarioParam;
}

/** Validates the child's echoed CLI workload and narrows its envelope to persisted latency data. */
export function parseLatencyChildResult(
  json: string,
  expectedWorkload: Record<string, number | string | boolean>
): LatencyRepetition {
  const envelope: unknown = JSON.parse(json);
  if (!isRecord(envelope) || !isRecord(envelope.options)) {
    throw new Error('child result is missing its parsed options envelope');
  }

  for (const [scenarioParam, expected] of Object.entries(expectedWorkload)) {
    const option = childOptionName(scenarioParam);
    if (!Object.hasOwn(envelope.options, option)) {
      throw new Error(`child result is missing echoed workload option "${option}"`);
    }
    const actual = envelope.options[option];
    if (actual !== expected) {
      throw new Error(
        `child echoed workload option "${option}" as ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
      );
    }
  }

  if (!isRecord(envelope.cold) || !Array.isArray(envelope.warm)) {
    throw new Error('child result is missing cold or warm latency observations');
  }
  if (envelope.scan !== undefined && !isRecord(envelope.scan)) {
    throw new Error('child result has an invalid scan latency observation');
  }

  return {
    cold: envelope.cold as unknown as LatencyRepetition['cold'],
    warm: envelope.warm as LatencyRepetition['warm'],
    ...(envelope.scan === undefined
      ? {}
      : {
          scan: envelope.scan as unknown as NonNullable<LatencyRepetition['scan']>,
        }),
  };
}

export function runLatencyChild(
  spec: LatencyChildSpec,
  outDir: string,
  jsonPath: string
): LatencyRepetition {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.rmSync(jsonPath, { force: true });

  const nodeArgs = [
    ...(spec.jiti ? ['--import', 'jiti/register'] : []),
    spec.childPath,
    ...spec.args,
    '--out',
    outDir,
    '--json',
    jsonPath,
  ];
  const proc = spawnSync(process.execPath, nodeArgs, {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;

  if (proc.status !== 0) {
    throw new Error(`child exited with status ${proc.status}:\n${outputTail(output, 4)}`);
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`child wrote no result JSON at ${jsonPath}:\n${outputTail(output, 4)}`);
  }
  return parseLatencyChildResult(fs.readFileSync(jsonPath, 'utf8'), spec.expectedWorkload);
}
