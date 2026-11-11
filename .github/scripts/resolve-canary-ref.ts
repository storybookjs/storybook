import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CanaryRefInputs = {
  pr?: string;
  branch?: string;
  sha?: string;
};

export type CanaryRefDefaults = {
  sha: string;
  branch: string;
  repository: string;
};

export type ResolvedCanaryRef = {
  repository: string;
  sha: string;
  branch: string;
  prNumber: number | null;
};

export type PullHead = {
  sha: string;
  ref: string;
  label: string;
  repo: { full_name: string } | null;
};

export type CanaryRefGitHub = {
  getPull(number: number): { number: number; head: PullHead };
  getBranch(branch: string): { name: string; commitSha: string };
  getCommit(sha: string): { sha: string };
};

export type GhClient = (args: string[], input?: string) => string;

export function optionalInput(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

export function parsePrNumber(value: string): number {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`invalid PR number: ${value}`);
  }
  return Number(normalized);
}

export function parseSha(value: string): string {
  const sha = value.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    throw new Error(`invalid sha: ${value} (use 7-40 hex characters)`);
  }
  return sha;
}

export function shasMatch(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a.startsWith(b) || b.startsWith(a);
}

export function branchesMatch(input: string, head: { ref: string; label: string }): boolean {
  return input === head.ref || input === head.label;
}

export function formatCanaryRefStepName(ref: ResolvedCanaryRef): string {
  return `canary-ref sha=${ref.sha} repo=${ref.repository} pr=${ref.prNumber ?? 'none'}`;
}

export function parseCanaryRefStepName(name: string): ResolvedCanaryRef {
  const match = name.match(/^canary-ref sha=([0-9a-f]{7,40}) repo=(\S+) pr=(\d+|none)$/i);
  if (!match) {
    throw new Error(`unrecognized canary-ref step: ${name}`);
  }
  return {
    sha: match[1].toLowerCase(),
    repository: match[2],
    branch: '',
    prNumber: match[3] === 'none' ? null : Number(match[3]),
  };
}

function mismatch(details: string): never {
  throw new Error(`canary ref inputs do not match: ${details}`);
}

export function resolveCanaryRef(
  raw: CanaryRefInputs,
  defaults: CanaryRefDefaults,
  github: CanaryRefGitHub
): ResolvedCanaryRef {
  const prInput = optionalInput(raw.pr);
  const branchInput = optionalInput(raw.branch);
  const shaInput = optionalInput(raw.sha);

  const prNumber = prInput ? parsePrNumber(prInput) : undefined;
  const sha = shaInput ? parseSha(shaInput) : undefined;

  if (prNumber === undefined && branchInput === undefined && sha === undefined) {
    return {
      repository: defaults.repository,
      sha: github.getCommit(defaults.sha).sha,
      branch: defaults.branch,
      prNumber: null,
    };
  }

  if (prNumber !== undefined) {
    const pull = github.getPull(prNumber);
    if (!pull.head.repo) {
      throw new Error(`PR #${prNumber} has no head repository`);
    }
    if (branchInput !== undefined && !branchesMatch(branchInput, pull.head)) {
      mismatch(`PR #${prNumber} head branch is ${pull.head.label}, branch is ${branchInput}`);
    }
    if (sha !== undefined && !shasMatch(pull.head.sha, sha)) {
      mismatch(`PR #${prNumber} head is ${pull.head.sha}, sha is ${sha}`);
    }
    return {
      repository: pull.head.repo.full_name,
      sha: pull.head.sha,
      branch: pull.head.ref,
      prNumber: pull.number,
    };
  }

  if (branchInput !== undefined) {
    const branch = github.getBranch(branchInput);
    if (sha !== undefined && !shasMatch(branch.commitSha, sha)) {
      mismatch(`branch ${branch.name} tip is ${branch.commitSha}, sha is ${sha}`);
    }
    return {
      repository: defaults.repository,
      sha: branch.commitSha,
      branch: branch.name,
      prNumber: null,
    };
  }

  if (sha === undefined) {
    throw new Error('canary ref is missing pr, branch, and sha');
  }

  try {
    const commit = github.getCommit(sha);
    return {
      repository: defaults.repository,
      sha: commit.sha,
      branch: shasMatch(commit.sha, defaults.sha) ? defaults.branch : '',
      prNumber: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `commit ${sha} not found in this repository; for a fork PR pass the PR number (${reason})`
    );
  }
}

export function createCanaryRefGitHub(repo: string, gh: GhClient): CanaryRefGitHub {
  return {
    getPull(number) {
      return JSON.parse(gh(['api', `repos/${repo}/pulls/${number}`])) as {
        number: number;
        head: PullHead;
      };
    },
    getBranch(branch) {
      const data = JSON.parse(
        gh(['api', `repos/${repo}/branches/${encodeURIComponent(branch)}`])
      ) as { name: string; commit: { sha: string } };
      return { name: data.name, commitSha: data.commit.sha };
    },
    getCommit(sha) {
      const data = JSON.parse(gh(['api', `repos/${repo}/commits/${sha}`])) as { sha: string };
      return { sha: data.sha };
    },
  };
}

function writeGithubOutput(ref: ResolvedCanaryRef): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    return;
  }
  appendFileSync(
    file,
    [
      `sha=${ref.sha}`,
      `repository=${ref.repository}`,
      `branch=${ref.branch}`,
      `pr=${ref.prNumber ?? ''}`,
      `step_name=${formatCanaryRefStepName(ref)}`,
    ].join('\n') + '\n'
  );
}

function parseArgs(argv: string[]): {
  repo: string;
  inputs: CanaryRefInputs;
  defaults: CanaryRefDefaults;
} {
  let repo = '';
  const inputs: CanaryRefInputs = {};
  const defaults: CanaryRefDefaults = { sha: '', branch: '', repository: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = (): string => argv[(i += 1)] ?? '';
    switch (arg) {
      case '--repo':
        repo = next();
        break;
      case '--pr':
        inputs.pr = next();
        break;
      case '--branch':
        inputs.branch = next();
        break;
      case '--sha':
        inputs.sha = next();
        break;
      case '--default-sha':
        defaults.sha = next();
        break;
      case '--default-branch':
        defaults.branch = next();
        break;
      case '--default-repository':
        defaults.repository = next();
        break;
      default:
        throw new Error(`unexpected argument: ${arg}`);
    }
  }

  if (!repo || !defaults.sha || !defaults.repository) {
    throw new Error(
      'usage: --repo REPO --default-sha SHA --default-repository REPO [--default-branch BRANCH] [--pr N] [--branch NAME] [--sha SHA]'
    );
  }

  return { repo, inputs, defaults };
}

function createGhClient(): GhClient {
  return (args: string[], input?: string): string =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const ref = resolveCanaryRef(
    parsed.inputs,
    parsed.defaults,
    createCanaryRefGitHub(parsed.repo, createGhClient())
  );
  writeGithubOutput(ref);
  console.log(JSON.stringify(ref));
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
