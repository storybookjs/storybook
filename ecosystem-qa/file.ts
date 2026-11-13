import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { dirname, join, resolve } from 'pathe';
import { z } from 'zod';

import {
  ASSETS_BRANCH,
  describeStep,
  missingPrerequisites,
  planFiling,
  renderDry,
  renderFilingReport,
  skipsReport,
  type FilingOutcome,
  type FilingStep,
  type KnownIssue,
} from './lib/filing.ts';
import { cycleRef } from './lib/cycle.ts';
import { listQaIssues, ghText, pages } from './lib/github.ts';
import { copyRedacted } from './lib/redact.ts';
import { hitsFor, openHit, QA_LABEL, writtenOn, type QaIssue } from './lib/proposals.ts';
import { pushTokenEnv } from './lib/push-targets.ts';
import { Proposal } from './lib/schema.ts';
import { writeStepSummary } from './lib/step-summary.ts';

const HELP = `Usage: node ecosystem-qa/file.ts --proposals <proposals.json> --repo <owner/name> [--dry]

--dry writes each proposal to $GITHUB_STEP_SUMMARY (stdout when unset) and changes nothing. It
reads the internal-qa issues with gh, so it shows what filing now would do, skips included.
Without --dry it checks that the milestones and labels exist, then for each proposal pushes the
cycle branch to the catalog repo with the push token of that repo's org, pushes evidence to the
qa-assets branch of --repo and creates the issue or comment with GH_TOKEN. A failed proposal does
not stop the others; the filed and failed table goes to the Step Summary and the exit code is 1 if
any failed.
An issue counts as already filed only while it is open and carries the internal-qa label.
Rerunning is safe: an issue it already created, an identical comment and pushed evidence are
skipped. When an open issue with one of a proposal's fingerprints appeared after the collect, what
that issue lacks goes on it as a comment and no second issue is created. A comment is skipped as a
repeat when the issue already has a sighting on every Storybook version, repo, system and engine
that the comment reports.`;

const EVIDENCE_PUSH_ATTEMPTS = 3;

const { values } = parseArgs({
  options: {
    proposals: { type: 'string' },
    repo: { type: 'string' },
    dry: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (!values.proposals || !values.repo) {
  console.error(`Missing --proposals or --repo.\n\n${HELP}`);
  process.exit(1);
}
const repo = values.repo;
const proposals = z.array(Proposal).parse(JSON.parse(readFileSync(values.proposals, 'utf8')));

// The token travels in git's config environment, never in argv: a failed command's error message
// repeats the argv, and the job log is public. Actions masks a secret only in the form it was
// stored, so the encoded form is registered as a mask too.
const authHeader = (token: string) =>
  `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;

const git = (cwd: string, args: string[], token?: string) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: token
      ? {
          ...process.env,
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
          GIT_CONFIG_VALUE_0: authHeader(token),
        }
      : process.env,
  }).trim();

const requireToken = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::add-mask::${authHeader(value).slice('AUTHORIZATION: basic '.length)}`);
  }
  return value;
};

const writeBody = (body: string) => {
  const file = join(mkdtempSync(join(tmpdir(), 'qa-body-')), 'body.md');
  writeFileSync(file, body);
  return file;
};

const pushCycle = (step: Extract<FilingStep, { kind: 'push-cycle' }>) => {
  const token = requireToken(pushTokenEnv(step.repo));
  const dir = mkdtempSync(join(tmpdir(), 'qa-cycle-'));
  const remote = `https://github.com/${step.repo}`;
  git(dir, ['init', '--quiet']);
  git(dir, ['fetch', '--quiet', '--depth', '1', remote, step.startSha], token);
  git(dir, ['fetch', '--quiet', resolve(step.bundle), 'refs/heads/*:refs/bundle/*']);
  git(dir, ['push', '--quiet', remote, `${step.headSha}:${cycleRef(step.branch)}`], token);
};

// Another filing job can move qa-assets between our fetch and push, so a rejected push starts over
// from the new tip.
const pushEvidence = (step: Extract<FilingStep, { kind: 'push-evidence' }>): void => {
  for (let attempt = 1; ; attempt++) {
    try {
      return commitEvidence(step);
    } catch (error) {
      if (attempt === EVIDENCE_PUSH_ATTEMPTS) {
        throw error;
      }
      console.warn(`Evidence push attempt ${attempt} failed, retrying from the new tip.`);
    }
  }
};

const commitEvidence = (step: Extract<FilingStep, { kind: 'push-evidence' }>) => {
  const token = requireToken('GH_TOKEN');
  const dir = mkdtempSync(join(tmpdir(), 'qa-assets-'));
  const remote = `https://github.com/${repo}`;
  git(dir, ['init', '--quiet']);
  if (git(dir, ['ls-remote', '--heads', remote, ASSETS_BRANCH], token) !== '') {
    git(dir, ['fetch', '--quiet', '--depth', '1', remote, ASSETS_BRANCH], token);
    git(dir, ['checkout', '--quiet', '-B', ASSETS_BRANCH, 'FETCH_HEAD']);
  } else {
    git(dir, ['checkout', '--quiet', '--orphan', ASSETS_BRANCH]);
  }
  for (const file of step.files) {
    const target = join(dir, step.assetDir, file.name);
    mkdirSync(dirname(target), { recursive: true });
    copyRedacted(resolve(file.localPath), target);
  }
  git(dir, ['add', '--all']);
  if (git(dir, ['status', '--porcelain']) === '') {
    return;
  }
  git(dir, [
    '-c',
    'user.name=Storybook Ecosystem QA',
    '-c',
    'user.email=ecosystem-qa@storybook.js.org',
    'commit',
    '--quiet',
    '-m',
    step.message,
  ]);
  git(dir, ['push', '--quiet', remote, `HEAD:refs/heads/${ASSETS_BRANCH}`], token);
};

const runStep = (step: FilingStep): string | undefined => {
  switch (step.kind) {
    case 'skip':
      return step.reason;
    case 'push-cycle':
      pushCycle(step);
      return undefined;
    case 'push-evidence':
      pushEvidence(step);
      return undefined;
    case 'create-issue':
      return ghText([
        'issue',
        'create',
        '--repo',
        repo,
        '--title',
        step.title,
        '--body-file',
        writeBody(step.body),
        '--milestone',
        step.milestone,
        ...step.labels.flatMap((label) => ['--label', label]),
      ]).trim();
    case 'comment':
      return ghText([
        'issue',
        'comment',
        String(step.issue),
        '--repo',
        repo,
        '--body-file',
        writeBody(step.body),
      ]).trim();
  }
};

const firstLine = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0]!.slice(0, 160);

const reportedOn = (proposal: Proposal, issues: QaIssue[]): QaIssue | undefined => {
  if (proposal.kind === 'issue') {
    return openHit(
      hitsFor(issues, [
        proposal.fingerprint,
        ...proposal.related.map((related) => related.fingerprint),
      ])
    );
  }
  return proposal.kind === 'comment'
    ? issues.find((issue) => issue.number === proposal.existingIssue)
    : undefined;
};

const knownIssue = (proposal: Proposal, issues: QaIssue[]): KnownIssue => {
  const target = reportedOn(proposal, issues);
  return {
    ...(proposal.kind === 'issue' && target ? { filedAs: target.number } : {}),
    existing: target ? writtenOn(target) : [],
  };
};

const fileProposal = (proposal: Proposal, issues: QaIssue[]): FilingOutcome => {
  const steps = planFiling(proposal, {
    repo,
    evidenceLinks: 'assets',
    ...knownIssue(proposal, issues),
  });
  let detail = '';
  for (const step of steps) {
    console.log(`${proposal.fingerprint}: ${describeStep(step, repo)}`);
    try {
      detail = runStep(step) ?? detail;
    } catch (error) {
      throw new Error(`${step.kind}: ${firstLine(error)}`, { cause: error });
    }
  }
  return { proposal, state: steps[0]?.kind === 'skip' ? 'skipped' : 'done', detail };
};

const checkPrerequisites = () => {
  if (!proposals.some((proposal) => proposal.kind === 'issue')) {
    return;
  }
  const problems = missingPrerequisites(proposals, {
    openMilestones: pages(
      z.object({ title: z.string() }),
      `repos/${repo}/milestones?state=open`
    ).map((milestone) => milestone.title),
    labels: pages(z.object({ name: z.string() }), `repos/${repo}/labels`).map(
      (label) => label.name
    ),
  });
  if (problems.length > 0) {
    console.error(`Nothing was filed. In ${repo}: ${problems.join('; ')}.`);
    process.exit(1);
  }
};

if (values.dry) {
  const counts = ['issue', 'comment', 'suppressed', 'skipped']
    .map((kind) => `${proposals.filter((proposal) => proposal.kind === kind).length} ${kind}`)
    .join(', ');
  const issues = listQaIssues(repo, QA_LABEL);
  const known = proposals.map((proposal) => knownIssue(proposal, issues));
  const reports = proposals.filter(({ kind }) => kind === 'issue' || kind === 'comment').length;
  const skipped = proposals.filter((proposal, index) =>
    skipsReport(proposal, planFiling(proposal, { repo, evidenceLinks: 'local', ...known[index] }))
  ).length;
  writeStepSummary(
    [
      '## Ecosystem QA proposals (dry run, nothing was filed)',
      '',
      `${proposals.length} proposals: ${counts}.`,
      `Filing now would skip ${skipped} of the ${reports} issues and comments, each with its reason below.`,
      '',
      ...proposals.map((proposal, index) => renderDry(proposal, repo, known[index])),
    ].join('\n')
  );
} else {
  checkPrerequisites();
  const issues = listQaIssues(repo, QA_LABEL);
  const outcomes = proposals.map((proposal): FilingOutcome => {
    try {
      return fileProposal(proposal, issues);
    } catch (error) {
      console.error(`${proposal.fingerprint} failed:`, error);
      return { proposal, state: 'failed', detail: firstLine(error) };
    }
  });
  writeStepSummary(renderFilingReport(outcomes));
  process.exitCode = outcomes.some((outcome) => outcome.state === 'failed') ? 1 : 0;
}
