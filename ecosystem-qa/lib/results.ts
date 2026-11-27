import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';

import { isAbsolute, join, relative } from 'pathe';

import { CHECK_IDS, checksFor } from '../checks.ts';
import { cycleBranchName, cycleRepo, publishedCycleBranch, readBundleHeader } from './cycle.ts';
import type { PlanScope } from './plan-scope.ts';
import { isProbeCheck, planCheckId, planRuns } from './qa-plan.ts';
import {
  Engine,
  Os,
  pushesCycle,
  RunResultFile,
  type CatalogEntry,
  type Cycle,
  type Finding,
  type PlanRecord,
} from './schema.ts';

export interface LoadedResult {
  resultPath: string;
  result: RunResultFile;
  cycle: Cycle;
  evidenceDir: string;
  systemInfo?: string;
}

interface RunKey {
  entry: CatalogEntry;
  os: Os;
  engine: Engine;
  part?: number;
  version: string;
}

interface LoadOptions {
  version: string;
  catalog: CatalogEntry[];
  plan?: PlanScope;
  warn: (message: string) => void;
}

// Only the artifact and local run directories below hold a record the runner wrote.
type RunPlace = Pick<RunKey, 'entry' | 'os' | 'engine'> & { part?: number };

const artifactName = ({ entry, os, engine, part }: RunPlace) =>
  `qa-result-${entry.id}-${os}-${engine}${part ? `-part-${part}` : ''}`;

const localRunDir = (resultsDir: string, { entry, os, engine, part }: RunPlace) =>
  join(resultsDir, entry.id, os, engine, ...(part ? [`part-${part}`] : []));

const artifactRunDir = (resultsDir: string, place: RunPlace) =>
  localRunDir(join(resultsDir, artifactName(place)), place);

const PART = /^part-([1-9]\d*)$/;

const namesIn = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir) : []);

// The cell itself and each part that a local run or an artifact of it holds.
const placesOf = (resultsDir: string, cell: RunPlace): RunPlace[] => {
  const prefix = `${artifactName(cell)}-`;
  const partNames = [
    ...namesIn(localRunDir(resultsDir, cell)),
    ...namesIn(resultsDir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length)),
  ];
  const parts = [...new Set(partNames.flatMap((name) => PART.exec(name)?.[1] ?? []))];
  return [cell, ...parts.map((part) => ({ ...cell, part: Number(part) }))];
};

const runPlaces = (resultsDir: string, catalog: CatalogEntry[]): RunPlace[] =>
  catalog.flatMap((entry) =>
    Os.options.flatMap((os) =>
      Engine.options.flatMap((engine) => placesOf(resultsDir, { entry, os, engine }))
    )
  );

// List where the runs of downloaded artifacts go in a local results directory: one entry for each
// catalog repo, OS, engine and part that `downloadDir` holds a record of.
export const downloadedRuns = (
  downloadDir: string,
  resultsDir: string,
  catalog: CatalogEntry[]
): { artifact: string; from: string; to: string; label: string }[] =>
  runPlaces(downloadDir, catalog).flatMap((place) => {
    const from = artifactRunDir(downloadDir, place);
    return existsSync(join(from, 'result.json'))
      ? [
          {
            artifact: artifactName(place),
            from,
            to: localRunDir(resultsDir, place),
            label: [
              place.entry.id,
              ...(place.part ? [`part ${place.part}`] : []),
              place.os,
              place.engine,
            ].join(' '),
          },
        ]
      : [];
  });

const otherPlan = (
  ran: PlanRecord | undefined,
  scope: PlanScope | undefined
): string | undefined => {
  if (!scope) {
    return (
      ran && `it ran batch ${ran.batch} of the plan ${ran.file} ${ran.hash}, and no plan was given`
    );
  }
  if (!ran) {
    return `it ran no plan, and this collect is of the plan ${scope.file} ${scope.hash}`;
  }
  if (ran.hash !== scope.hash) {
    return `it ran the plan ${ran.file} ${ran.hash}, not ${scope.file} ${scope.hash}`;
  }
  return ran.batch === scope.batch
    ? undefined
    : `it ran batch ${ran.batch} of the plan, not batch ${scope.batch}`;
};

// The record comes from a run that executed the repository's code, so only the plan file and the
// collect say which runs the batch has, which tier they ran, and which plan checks each part has.
const knownChecksOf = (
  scope: PlanScope,
  { entry, plan, tier }: RunResultFile['request']
): string[] | string => {
  const run = planRuns(scope.plan, scope.batch).find(
    (candidate) => candidate.repo === entry.id && candidate.part === plan?.part
  );
  if (!run) {
    return `batch ${scope.batch} of the plan has no part ${plan?.part} for ${entry.id}`;
  }
  if (tier !== scope.tier) {
    return `it says it ran the tier ${tier}, and this collect is of the tier ${scope.tier}`;
  }
  return [...checksFor(scope.tier).map(({ id }) => id), ...run.entries.map(planCheckId)];
};

// A static record may report any id of checks.ts, so records of earlier sweeps still load after a
// check changes tier.
const outOfScope = (record: RunResultFile, scope: PlanScope | undefined): string | undefined => {
  const other = otherPlan(record.request.plan, scope);
  if (other) {
    return other;
  }
  const checks = scope ? knownChecksOf(scope, record.request) : CHECK_IDS;
  if (typeof checks === 'string') {
    return checks;
  }
  const known = new Set<string>(checks);
  const ids = [
    ...record.checks.map(({ id }) => id),
    ...record.findings.map(({ checkId }) => checkId),
  ];
  const unknown = [...new Set(ids.filter((id) => !known.has(id)))];
  if (unknown.length === 0) {
    return undefined;
  }
  return `it reports ${unknown.join(', ')}, which ${scope ? `is neither a check of the tier ${scope.tier} nor a plan check of its part` : 'is no check of checks.ts'}`;
};

const evidenceProblem = (evidenceDir: string, name: string): string | undefined => {
  const path = join(evidenceDir, name);
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (!stats) {
    return 'it does not exist';
  }
  if (!stats.isFile()) {
    return stats.isSymbolicLink() ? 'it is a symlink' : 'it is not a regular file';
  }
  const inside = relative(realpathSync(evidenceDir), realpathSync(path));
  if (inside.startsWith('..') || isAbsolute(inside)) {
    return 'it resolves outside the evidence directory';
  }
  return undefined;
};

// `storybook info` runs through the package manager's dlx, whose install log precedes the report.
// A capture without the report, because the command crashed, is no info at all.
const environmentInfo = (captured: string): string | undefined => {
  const plain = captured.replace(/\x1b\[[0-9;]*m/g, '');
  const start = plain.indexOf('Storybook Environment Info');
  if (start < 0) {
    return undefined;
  }
  return plain
    .slice(start)
    .split('\n')
    .map((line) => line.replace(/^│\s*/, '').trimEnd())
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n')
    .trim();
};

const keepPublishable = (
  finding: Finding,
  evidenceDir: string,
  warn: (message: string) => void
): Finding => {
  const publishable = (name: string | undefined) => {
    if (name === undefined) {
      return false;
    }
    const problem = evidenceProblem(evidenceDir, name);
    if (problem) {
      warn(`Dropping evidence ${name} of "${finding.title}": ${problem}.`);
    }
    return !problem;
  };
  const { png, gif, logs } = finding.evidence;
  return {
    ...finding,
    evidence: {
      ...(publishable(png) ? { png } : {}),
      ...(publishable(gif) ? { gif } : {}),
      logs: logs.filter(publishable),
    },
  };
};

// The run adds a probe only after the upgrade, so its finding has no baseline whatever the record
// says, and nothing reads it as pre-existing.
const dropProbeBaseline = (finding: Finding, scope: PlanScope | undefined): Finding =>
  isProbeCheck(scope?.plan.entries, finding.checkId)
    ? { ...finding, baseline: 'not-captured' }
    : finding;

const readCycle = (
  dir: string,
  key: RunKey,
  recordedStartSha: string,
  warn: (message: string) => void
): Cycle => {
  const branch = cycleBranchName(key.version, key.os, key.engine);
  const noCommits = {
    repo: cycleRepo(key.entry),
    branch,
    startSha: recordedStartSha,
    headSha: null,
    bundle: null,
  };
  if (!pushesCycle(key.entry)) {
    return { ...noCommits, startSha: key.entry.ref };
  }
  const bundle = join(dir, 'cycle.bundle');
  if (!existsSync(bundle)) {
    return noCommits;
  }
  try {
    const header = readBundleHeader(bundle);
    const headSha = header.refs.get(`refs/heads/${branch}`);
    if (!headSha) {
      warn(`${bundle} has no ref for ${branch}; ignoring it.`);
      return noCommits;
    }
    const [startSha] = header.prerequisites.length === 1 ? header.prerequisites : [];
    return {
      ...noCommits,
      branch: publishedCycleBranch(branch, headSha),
      startSha: startSha ?? recordedStartSha,
      headSha,
      bundle,
    };
  } catch (error) {
    warn(`${bundle} is unreadable (${String(error)}); ignoring it.`);
    return noCommits;
  }
};

const loadRun = (
  dir: string,
  key: RunKey,
  { plan, warn }: Pick<LoadOptions, 'plan' | 'warn'>
): LoadedResult | undefined => {
  const resultPath = join(dir, 'result.json');
  let record: unknown;
  try {
    record = JSON.parse(readFileSync(resultPath, 'utf8'));
  } catch (error) {
    warn(`${resultPath} is unreadable (${String(error)}); ignoring it.`);
    return undefined;
  }
  const parsed = RunResultFile.safeParse(record);
  if (!parsed.success) {
    warn(`${resultPath} is not a valid result record; ignoring it: ${parsed.error.message}`);
    return undefined;
  }
  const { request } = parsed.data;
  // A build usually carries the version of the last prerelease, so its record would pass for a
  // sighting of that release.
  if (request.build) {
    warn(
      `${resultPath} ran the build of commit ${request.build}, which proves a fix for a pull request and is never a finding of a release; ignoring it.`
    );
    return undefined;
  }
  const mismatch = [
    request.entry.id !== key.entry.id && 'repo id',
    request.os !== key.os && 'os',
    request.engine !== key.engine && 'engine',
    request.version !== key.version && 'version',
    request.plan?.part !== key.part && 'part',
  ].filter(Boolean);
  if (mismatch.length > 0) {
    warn(
      `${resultPath} disagrees with the run it belongs to on ${mismatch.join(', ')}; ignoring it.`
    );
    return undefined;
  }
  const outside = outOfScope(parsed.data, plan);
  if (outside) {
    warn(`${resultPath} is not part of this collect, because ${outside}; ignoring it.`);
    return undefined;
  }
  const evidenceDir = join(dir, 'evidence');
  const infoProblem = evidenceProblem(evidenceDir, 'storybook-info.txt');
  return {
    resultPath,
    result: {
      ...parsed.data,
      request: { ...request, entry: key.entry },
      findings: parsed.data.findings.map((finding) =>
        dropProbeBaseline(keepPublishable(finding, evidenceDir, warn), plan)
      ),
    },
    cycle: readCycle(dir, key, parsed.data.startSha, warn),
    evidenceDir,
    ...(infoProblem
      ? {}
      : {
          systemInfo: environmentInfo(
            readFileSync(join(evidenceDir, 'storybook-info.txt'), 'utf8')
          ),
        }),
  };
};

// Load every run record of one cycle from the places the runner writes them.
//
// The repository, branch and version come from the catalog and the caller, not from the record,
// and evidence that is missing, a symlink or outside its run's evidence directory is dropped.
export const loadResults = (
  resultsDir: string,
  { version, catalog, plan, warn }: LoadOptions
): LoadedResult[] =>
  runPlaces(resultsDir, catalog).flatMap((place) => {
    const key = { ...place, version };
    return [artifactRunDir(resultsDir, place), localRunDir(resultsDir, place)]
      .filter((dir) => existsSync(join(dir, 'result.json')))
      .flatMap((dir) => loadRun(dir, key, { plan, warn }) ?? []);
  });

// Whether the installed Storybook is the version the run was asked to upgrade to.
export const upgraded = (result: RunResultFile): boolean =>
  result.storybookVersionInstalled === result.request.version;
