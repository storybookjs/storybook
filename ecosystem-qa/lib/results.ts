import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';

import { isAbsolute, join, relative } from 'pathe';

import { cycleBranchName, publishedCycleBranch, readBundleHeader } from './cycle.ts';
import {
  Engine,
  Os,
  RunResultFile,
  type CatalogEntry,
  type Cycle,
  type Finding,
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
  version: string;
}

interface LoadOptions {
  version: string;
  catalog: CatalogEntry[];
  warn: (message: string) => void;
}

// The runner job uploads results/ as the artifact qa-result-<os>-<engine>; a local run writes
// results/<id>/<os>/<engine> directly. Only these two places hold a record the runner wrote.
const runDirs = (resultsDir: string, { entry, os, engine }: RunKey) => [
  join(resultsDir, `qa-result-${os}-${engine}`, entry.id, os, engine),
  join(resultsDir, entry.id, os, engine),
];

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

const readCycle = (
  dir: string,
  key: RunKey,
  recordedStartSha: string,
  warn: (message: string) => void
): Cycle => {
  const branch = cycleBranchName(key.version, key.os, key.engine);
  const noCommits = {
    repo: key.entry.pushTo ?? key.entry.repo,
    branch,
    startSha: recordedStartSha,
    headSha: null,
    bundle: null,
  };
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
  warn: (message: string) => void
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
  const mismatch = [
    request.entry.id !== key.entry.id && 'repo id',
    request.os !== key.os && 'os',
    request.engine !== key.engine && 'engine',
    request.version !== key.version && 'version',
  ].filter(Boolean);
  if (mismatch.length > 0) {
    warn(
      `${resultPath} disagrees with the run it belongs to on ${mismatch.join(', ')}; ignoring it.`
    );
    return undefined;
  }
  const evidenceDir = join(dir, 'evidence');
  const infoProblem = evidenceProblem(evidenceDir, 'storybook-info.txt');
  return {
    resultPath,
    result: {
      ...parsed.data,
      request: { ...request, entry: key.entry },
      findings: parsed.data.findings.map((finding) => keepPublishable(finding, evidenceDir, warn)),
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
  { version, catalog, warn }: LoadOptions
): LoadedResult[] =>
  catalog.flatMap((entry) =>
    Os.options.flatMap((os) =>
      Engine.options.flatMap((engine) => {
        const key = { entry, os, engine, version };
        return runDirs(resultsDir, key)
          .filter((dir) => existsSync(join(dir, 'result.json')))
          .flatMap((dir) => loadRun(dir, key, warn) ?? []);
      })
    )
  );
