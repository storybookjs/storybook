import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { dirname, join, resolve } from 'pathe';
import { z } from 'zod';

import {
  ASSETS_BRANCH,
  describeStep,
  planFiling,
  renderDry,
  type FilingStep,
} from './lib/filing.ts';
import { gh, searchFingerprint } from './lib/github.ts';
import { Proposal } from './lib/schema.ts';
import type { Proposal as ProposalType } from './lib/types.ts';

const HELP = `Usage: node ecosystem-qa/file.ts --proposals <proposals.json> --repo <owner/name> [--dry]

--dry writes each proposal to $GITHUB_STEP_SUMMARY (stdout when unset) and changes nothing.
Without --dry it pushes the cycle branch to the catalog repo with ECOSYSTEM_QA_PUSH_TOKEN, pushes
evidence to the qa-assets branch of --repo and creates the issue or comment with GH_TOKEN.`;

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

const git = (cwd: string, args: string[], token?: string) =>
  execFileSync(
    'git',
    token
      ? [
          '-c',
          `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
          ...args,
        ]
      : args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  ).trim();

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
};

const writeBody = (body: string) => {
  const file = join(mkdtempSync(join(tmpdir(), 'qa-body-')), 'body.md');
  writeFileSync(file, body);
  return file;
};

const pushCycle = (step: Extract<FilingStep, { kind: 'push-cycle' }>) => {
  const token = requireEnv('ECOSYSTEM_QA_PUSH_TOKEN');
  const dir = mkdtempSync(join(tmpdir(), 'qa-cycle-'));
  const remote = `https://github.com/${step.repo}`;
  const ref = `refs/heads/${step.branch}`;
  git(dir, ['init', '--quiet']);
  git(dir, ['fetch', '--quiet', '--depth', '1', remote, step.startSha], token);
  git(dir, ['fetch', '--quiet', resolve(step.bundle), `${ref}:${ref}`]);
  git(dir, ['push', '--quiet', remote, `${step.headSha}:${ref}`], token);
};

const pushEvidence = (step: Extract<FilingStep, { kind: 'push-evidence' }>) => {
  const token = requireEnv('GH_TOKEN');
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
    copyFileSync(resolve(file.localPath), target);
  }
  git(dir, ['add', '--all']);
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

const runStep = (step: FilingStep) => {
  switch (step.kind) {
    case 'skip':
      return;
    case 'push-cycle':
      return pushCycle(step);
    case 'push-evidence':
      return pushEvidence(step);
    case 'create-issue':
      console.log(
        gh(
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
          ...step.labels.flatMap((label) => ['--label', label])
        ).trim()
      );
      return;
    case 'comment':
      gh(
        'issue',
        'comment',
        String(step.issue),
        '--repo',
        repo,
        '--body-file',
        writeBody(step.body)
      );
      return;
  }
};

const CommentPages = z.array(z.array(z.object({ body: z.string() })));

const commentsOn = (issue: number): string[] =>
  CommentPages.parse(
    JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repo}/issues/${issue}/comments`))
  )
    .flat()
    .map((comment) => comment.body);

const fileProposal = (proposal: ProposalType) => {
  const steps = planFiling(proposal, {
    repo,
    evidenceLinks: 'assets',
    ...(proposal.kind === 'issue'
      ? { filedAs: searchFingerprint(repo, proposal.fingerprint)[0]?.number }
      : {}),
    ...(proposal.kind === 'comment' ? { comments: commentsOn(proposal.existingIssue) } : {}),
  });
  for (const step of steps) {
    console.log(`${proposal.fingerprint}: ${describeStep(step, repo)}`);
    runStep(step);
  }
};

if (values.dry) {
  const counts = ['issue', 'comment', 'suppressed']
    .map((kind) => `${proposals.filter((proposal) => proposal.kind === kind).length} ${kind}`)
    .join(', ');
  const summary = [
    '## Ecosystem QA proposals (dry run, nothing was filed)',
    '',
    `${proposals.length} proposals: ${counts}.`,
    '',
    ...proposals.map((proposal) => renderDry(proposal, repo)),
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } else {
    console.log(summary);
  }
} else {
  proposals.forEach(fileProposal);
}
