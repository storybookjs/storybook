// Test support: plants stored-run artifacts that read back as real
// measurements. result.json carries the case's own config and the fixture's
// pin, and project/ carries the fixture's task files, so readRunMeasurement
// derives exactly what currentMeasurement derives (see ../identity.ts) —
// unless `superseded` asks for a pin the pair no longer measures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AGENTIC_REF_CASES } from '../cases.ts';
import { EVALS_DIR, EXPERIMENT_NAME_PREFIX } from '../constants.ts';
import { AGENT_CONFIG, providerOf } from '../experiment.ts';
import { parseExternalRepoFromManifest } from '../external-repo.ts';

/** A pin no fixture uses, for planting runs of a measurement since replaced. */
const SUPERSEDED_PIN = { repo: 'yannbf/mealdrop', ref: 'refs/tags/agentic-reference/replaced-v0' };

/** result.json fields that read back as what `experiment` × `evalName` measures today. */
export function measuredResultJson(
  experiment: string,
  evalName: string,
  options: { status?: 'passed' | 'failed'; superseded?: boolean } = {}
): Record<string, unknown> {
  const caseName = experiment.slice(EXPERIMENT_NAME_PREFIX.length);
  const caseDef = AGENTIC_REF_CASES.find((candidate) => candidate.name === caseName);
  if (caseDef === undefined) {
    throw new Error(`measuredResultJson: unknown case "${caseName}"`);
  }
  const agentConfig = AGENT_CONFIG[caseDef.agent ?? 'claude-code'];
  const model = agentConfig.model;
  const pin = options.superseded
    ? SUPERSEDED_PIN
    : parseExternalRepoFromManifest(
        readFileSync(join(EVALS_DIR, evalName, 'package.json'), 'utf8')
      );
  return {
    status: options.status ?? 'passed',
    model: Array.isArray(model) ? model.join(',') : model,
    analysis: {
      provider: providerOf(caseDef.overrides?.agent ?? agentConfig.agent),
      externalRepo: pin,
      case: {
        integration: caseDef.integration,
        storybookMcpPackage: caseDef.storybookMcpPackage,
        storybookMcpUrl: caseDef.storybookMcpUrl,
        ...(caseDef.editPrompt === undefined ? {} : { editPrompt: true }),
      },
    },
  };
}

/** Copies the fixture's task files into a run's project tree, so task digests match. */
export function copyTaskFixture(evalName: string, projectDir: string): void {
  mkdirSync(projectDir, { recursive: true });
  for (const file of ['PROMPT.md', 'EVAL.ts']) {
    writeFileSync(join(projectDir, file), readFileSync(join(EVALS_DIR, evalName, file), 'utf8'));
  }
}
