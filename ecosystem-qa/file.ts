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

import { basename, dirname, join, resolve } from 'pathe';
import { z } from 'zod';

import { gh, searchFingerprint } from './lib/github.ts';
import { fence } from './lib/proposals.ts';
import { Proposal, RunResultFile } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/file.ts --proposals <proposals.json> --repo <owner/name> [--dry]

--dry writes each proposal to $GITHUB_STEP_SUMMARY (stdout when unset) and changes nothing.
Without --dry it pushes evidence to the qa-assets branch of --repo, pushes the cycle branch to the
catalog repo with ECOSYSTEM_QA_PUSH_TOKEN, and creates the issue or comment with GH_TOKEN.`;

const ASSETS_BRANCH = 'qa-assets';

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

const readResult = (proposal: z.infer<typeof Proposal>) => {
  const [primary] = proposal.sources;
  if (!primary) {
    throw new Error(`Proposal ${proposal.fingerprint} has no sources.`);
  }
  const result = RunResultFile.parse(JSON.parse(readFileSync(primary.resultPath, 'utf8')));
  return { result, resultDir: dirname(primary.resultPath) };
};

const assetDir = (proposal: z.infer<typeof Proposal>) =>
  `assets/${readResult(proposal).result.request.version}/${proposal.fingerprint}`;

const renderDry = (proposal: z.infer<typeof Proposal>): string => {
  const { result, resultDir } = readResult(proposal);
  const target =
    proposal.kind === 'issue'
      ? `new issue in ${repo}, milestone ${proposal.milestone}`
      : proposal.kind === 'comment'
        ? `comment on ${repo}#${proposal.existingIssue}`
        : `nothing: ${repo}#${proposal.existingIssue} is labelled qa:known`;
  const bundle = result.paths.bundle
    ? `push \`${join(resultDir, result.paths.bundle)}\` to ${result.request.entry.repo} as \`${result.cycleBranch}\``
    : 'none, the run made no commits';
  return [
    `<details><summary><b>${proposal.kind}</b> ${proposal.title} <code>${proposal.fingerprint}</code></summary>`,
    '',
    `- Target: ${target}`,
    `- Labels: ${proposal.labels.map((label) => `\`${label}\``).join(', ')}`,
    `- Sources: ${proposal.sources.map((source) => `${source.os}/${source.engine} (\`${source.resultPath}\`)`).join(', ')}`,
    `- Evidence for \`${ASSETS_BRANCH}/${assetDir(proposal)}/\`: ${proposal.evidenceFiles.map((file) => `\`${file}\``).join(', ') || 'none'}`,
    `- Cycle branch: ${bundle}`,
    '',
    ...(proposal.body ? [fence(proposal.body, 'markdown'), ''] : []),
    '</details>',
    '',
  ].join('\n');
};

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

const pushEvidence = (proposal: z.infer<typeof Proposal>): string => {
  const token = requireEnv('GH_TOKEN');
  const dir = mkdtempSync(join(tmpdir(), 'qa-assets-'));
  const remote = `https://github.com/${repo}`;
  git(dir, ['init', '--quiet']);
  const exists = git(dir, ['ls-remote', '--heads', remote, ASSETS_BRANCH], token) !== '';
  if (exists) {
    git(dir, ['fetch', '--quiet', '--depth', '1', remote, ASSETS_BRANCH], token);
    git(dir, ['checkout', '--quiet', '-B', ASSETS_BRANCH, 'FETCH_HEAD']);
  } else {
    git(dir, ['checkout', '--quiet', '--orphan', ASSETS_BRANCH]);
  }
  const target = assetDir(proposal);
  mkdirSync(join(dir, target), { recursive: true });
  let body = proposal.body;
  for (const file of proposal.evidenceFiles) {
    copyFileSync(resolve(file), join(dir, target, basename(file)));
    body = body.replaceAll(
      `](${file})`,
      `](https://raw.githubusercontent.com/${repo}/${ASSETS_BRANCH}/${target}/${basename(file)})`
    );
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
    `qa: evidence for ${proposal.fingerprint}`,
  ]);
  git(dir, ['push', '--quiet', remote, `HEAD:refs/heads/${ASSETS_BRANCH}`], token);
  return body;
};

const pushCycleBranch = (proposal: z.infer<typeof Proposal>) => {
  const { result, resultDir } = readResult(proposal);
  if (!result.paths.bundle || !result.headSha) {
    return;
  }
  const token = requireEnv('ECOSYSTEM_QA_PUSH_TOKEN');
  const dir = mkdtempSync(join(tmpdir(), 'qa-cycle-'));
  const remote = `https://github.com/${result.request.entry.repo}`;
  git(dir, ['init', '--quiet']);
  git(dir, ['fetch', '--quiet', '--depth', '1', remote, result.startSha], token);
  git(dir, [
    'fetch',
    '--quiet',
    resolve(resultDir, result.paths.bundle),
    `${result.cycleBranch}:refs/heads/${result.cycleBranch}`,
  ]);
  git(
    dir,
    ['push', '--quiet', remote, `${result.headSha}:refs/heads/${result.cycleBranch}`],
    token
  );
};

const alreadyCommented = (issue: number, body: string) => {
  const metadata = body.slice(body.indexOf('<!-- sb-qa-metadata -->'));
  return gh(
    'api',
    '--paginate',
    `repos/${repo}/issues/${issue}/comments`,
    '--jq',
    '.[].body'
  ).includes(metadata.trim());
};

const fileProposal = (proposal: z.infer<typeof Proposal>) => {
  if (proposal.kind === 'suppressed') {
    console.log(`Suppressed ${proposal.fingerprint}: #${proposal.existingIssue} is qa:known.`);
    return;
  }
  if (proposal.kind === 'comment') {
    const issue = proposal.existingIssue!;
    if (alreadyCommented(issue, proposal.body)) {
      console.log(`#${issue} already has this comment.`);
      return;
    }
    const bodyFile = join(mkdtempSync(join(tmpdir(), 'qa-body-')), 'body.md');
    writeFileSync(bodyFile, proposal.body);
    gh('issue', 'comment', String(issue), '--repo', repo, '--body-file', bodyFile);
    console.log(`Commented on #${issue}.`);
    return;
  }
  const [existing] = searchFingerprint(repo, proposal.fingerprint);
  if (existing) {
    console.log(
      `${proposal.fingerprint} is already filed as #${existing.number}; not filing again.`
    );
    return;
  }
  pushCycleBranch(proposal);
  const bodyFile = join(mkdtempSync(join(tmpdir(), 'qa-body-')), 'body.md');
  writeFileSync(bodyFile, pushEvidence(proposal));
  const url = gh(
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    proposal.title,
    '--body-file',
    bodyFile,
    '--milestone',
    proposal.milestone,
    ...proposal.labels.flatMap((label) => ['--label', label])
  ).trim();
  console.log(`Filed ${url}.`);
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
    ...proposals.map(renderDry),
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } else {
    console.log(summary);
  }
} else {
  proposals.forEach(fileProposal);
}
