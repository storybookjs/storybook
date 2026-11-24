import { readFileSync, statSync } from 'node:fs';

import { basename } from 'pathe';

import { loadEntries } from './catalog.ts';
import { versionLine } from './cycle.ts';
import {
  checkPlanText,
  planBatches,
  planHash,
  planRuns,
  type Plan,
  type PlanEntry,
} from './qa-plan.ts';
import { PlanRecord, Tier } from './schema.ts';

export interface PlanScope {
  file: string;
  hash: string;
  plan: Plan;
  batch: number;
  // The tier every run of the batch ran, which a record cannot choose for itself.
  tier: Tier;
}

export interface PlannedRun {
  plan: Plan;
  record: PlanRecord;
  entries: PlanEntry[];
}

// The one line a script prints before it exits 1.
type Refusal = string;

export const refuse = (message: Refusal): never => {
  console.error(message);
  process.exit(1);
};

const wholeNumber = (flag: string, value: string): number | Refusal =>
  /^[1-9]\d*$/.test(value)
    ? Number(value)
    : `${flag} must be a whole number from 1, found "${value}".`;

// Check a plan file and pick one batch of it, as --plan, --batch and --tier name them.
export const planScopeOf = (
  path: string,
  bytes: Uint8Array,
  { batch, tier = 'gate' }: { batch?: string | undefined; tier?: string | undefined }
): PlanScope | Refusal => {
  if (!batch) {
    return '--plan needs --batch.';
  }
  const number = wholeNumber('--batch', batch);
  if (typeof number === 'string') {
    return number;
  }
  const parsedTier = Tier.safeParse(tier);
  if (!parsedTier.success) {
    return `--tier ${JSON.stringify(tier)}: ${parsedTier.error.issues[0]!.message}.`;
  }
  const file = basename(path);
  if (!PlanRecord.shape.file.safeParse(file).success) {
    return `${path} cannot name a run record: use letters, digits, dots and hyphens, ending in .md.`;
  }
  const { plan, problems } = checkPlanText(Buffer.from(bytes).toString('utf8'), {
    catalog: loadEntries(),
  });
  if (!plan || problems.length > 0) {
    const [first] = problems;
    return `${path} is not a plan that can run, line ${first!.line}: ${first!.message}`;
  }
  const batches = planBatches(plan);
  if (!batches.includes(number)) {
    return `${path} has no batch ${number}, only 1 to ${batches.length}.`;
  }
  return { file, hash: planHash(bytes), plan, batch: number, tier: parsedTier.data };
};

// Read the scope of a script's --plan, --batch and --tier, refusing anything that does not name
// one batch of a plan that can run. Without --plan there is no scope.
export const readPlanScope = (values: {
  plan?: string | undefined;
  batch?: string | undefined;
  tier?: string | undefined;
}): PlanScope | undefined => {
  const { plan: path, batch } = values;
  if (!path) {
    return batch ? refuse('--batch needs --plan.') : undefined;
  }
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats) {
    return refuse(`${path} does not exist.`);
  }
  if (!stats.isFile()) {
    return refuse(`${path} is not a file.`);
  }
  const scope = planScopeOf(path, readFileSync(path), values);
  return typeof scope === 'string' ? refuse(scope) : scope;
};

// Pick the part of the scope's batch that one run of `repo` on `version` does.
export const plannedRun = (
  { plan, file, hash, batch }: PlanScope,
  {
    repo,
    version,
    build,
    part = '1',
  }: { repo: string; version: string; build?: string | undefined; part?: string | undefined }
): PlannedRun | Refusal => {
  const number = wholeNumber('--part', part);
  if (typeof number === 'string') {
    return number;
  }
  if (versionLine(version) !== plan.line) {
    const target = build ? `--build ${build} installs ${version}, which` : `--version ${version}`;
    return `${file} plans line ${plan.line}, and ${target} is on line ${versionLine(version)}.`;
  }
  const parts = planRuns(plan, batch).filter((run) => run.repo === repo);
  if (parts.length === 0) {
    return `Batch ${batch} of ${file} lists no entry for ${repo}.`;
  }
  const run = parts.find((candidate) => candidate.part === number);
  if (!run) {
    return `Batch ${batch} of ${file} has ${parts.length} part(s) for ${repo}, not part ${number}.`;
  }
  const entries = run.entries.map((slug) => plan.entries.find((entry) => entry.slug === slug)!);
  return {
    plan,
    record: {
      file,
      hash,
      batch,
      part: number,
      entries: entries.map(({ slug, prs }) => ({ id: slug, prs })),
    },
    entries,
  };
};
