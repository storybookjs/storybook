import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { x } from 'tinyexec';
import type { AgentVariant } from './agents/config.ts';
import type { Project } from './projects.ts';
import type { TrialWorkspace } from './prepare-trial.ts';
import type { Logger } from './utils.ts';
import type { ScreenshotArtifact } from './screenshots.ts';

export interface PublishMetadata {
  branch: string;
  labels: string[];
  prUrl?: string;
  summaryUrl: string;
  transcriptUrl: string;
  screenshots: ScreenshotArtifact[];
}

export function buildTrialLabels(project: Project, variant: AgentVariant, prompt: string) {
  return [
    'eval',
    `project:${project.name}`,
    `agent:${variant.agent}`,
    `model:${variant.model}`,
    `effort:${variant.effort}`,
    `prompt:${prompt}`,
  ];
}

export function buildTrialArtifactUrls(project: Project, branch: string) {
  return {
    summaryUrl: createBlobUrl(project.githubSlug, branch, 'eval-results/summary.json'),
    transcriptUrl: createBlobUrl(project.githubSlug, branch, 'eval-results/transcript.json'),
  };
}

export async function publishTrialBranch(opts: {
  project: Project;
  workspace: TrialWorkspace;
  variant: AgentVariant;
  prompt: string;
  trialId: string;
  score: number;
  screenshots: ScreenshotArtifact[];
  logger: Logger;
}) {
  const labels = buildTrialLabels(opts.project, opts.variant, opts.prompt);
  const { summaryUrl, transcriptUrl } = buildTrialArtifactUrls(
    opts.project,
    opts.workspace.trialBranch
  );

  await ensureEvalResultsStoriesGlob({
    projectPath: opts.workspace.projectPath,
    resultsDir: opts.workspace.resultsDir,
  });
  await writeChromaticWorkflow(opts.project, opts.workspace);

  const prBody = renderPrBody({
    branch: opts.workspace.trialBranch,
    prompt: opts.prompt,
    project: opts.project.name,
    repo: opts.project.githubSlug,
    score: opts.score,
    summaryUrl,
    transcriptUrl,
    screenshots: opts.screenshots,
    trialId: opts.trialId,
  });
  const prBodyPath = join(opts.workspace.resultsDir, 'pr-body.md');
  await writeFile(prBodyPath, prBody);

  opts.logger.logStep('Creating trial commit...');
  await ensureGitIdentity(opts.workspace.repoRoot);
  await x('git', ['add', '-A'], { nodeOptions: { cwd: opts.workspace.repoRoot } });
  await x('git', ['commit', '-m', `eval: ${opts.trialId}`], {
    nodeOptions: { cwd: opts.workspace.repoRoot },
  });

  opts.logger.logStep(`Pushing ${opts.workspace.trialBranch}...`);
  await x('git', ['push', '--set-upstream', 'origin', opts.workspace.trialBranch], {
    timeout: 120_000,
    nodeOptions: { cwd: opts.workspace.repoRoot },
  });

  await ensureLabels(opts.project.githubSlug, labels);

  opts.logger.logStep('Opening draft PR...');
  const title = `[eval] ${opts.project.name} ${opts.trialId}`;
  const prUrl = (
    await x(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        opts.project.githubSlug,
        '--base',
        opts.project.branch,
        '--head',
        opts.workspace.trialBranch,
        '--draft',
        '--title',
        title,
        '--body-file',
        prBodyPath,
      ],
      { nodeOptions: { cwd: opts.workspace.repoRoot } }
    )
  ).stdout.trim();

  for (const label of labels) {
    await x('gh', ['pr', 'edit', prUrl, '--repo', opts.project.githubSlug, '--add-label', label], {
      nodeOptions: { cwd: opts.workspace.repoRoot },
    });
  }

  return {
    branch: opts.workspace.trialBranch,
    labels,
    prUrl,
    summaryUrl,
    transcriptUrl,
    screenshots: opts.screenshots,
  } satisfies PublishMetadata;
}

async function ensureLabels(repo: string, labels: string[]) {
  for (const label of labels) {
    await x(
      'gh',
      [
        'label',
        'create',
        label,
        '--repo',
        repo,
        '--color',
        '6E7781',
        '--description',
        `Automated eval label for ${label}`,
        '--force',
      ],
      { throwOnError: false }
    );
  }
}

async function ensureEvalResultsStoriesGlob(opts: { projectPath: string; resultsDir: string }) {
  const configPath = await findStorybookMainFile(opts.projectPath);
  if (!configPath) {
    return;
  }

  const content = await readFile(configPath, 'utf-8');
  const relativePattern = relative(dirname(configPath), join(opts.resultsDir, '*.mdx')).replaceAll(
    '\\',
    '/'
  );
  const quotedPattern = `'${relativePattern}'`;
  if (content.includes(relativePattern)) {
    return;
  }

  const updated = content.replace(
    /((?:stories|"stories")\s*:\s*\[[\s\S]*?)(\])/m,
    (_, start: string, end: string) =>
      `${start}${start.trimEnd().endsWith('[') ? '' : ','}\n    ${quotedPattern}\n  ${end}`
  );

  if (updated !== content) {
    await writeFile(configPath, updated);
  }
}

async function findStorybookMainFile(projectPath: string) {
  const candidates = ['main.ts', 'main.js', 'main.mts', 'main.mjs', 'main.cjs'].map((file) =>
    join(projectPath, '.storybook', file)
  );
  return candidates.find((candidate) => existsSync(candidate));
}

async function writeChromaticWorkflow(project: Project, workspace: TrialWorkspace) {
  const workflowPath = join(workspace.repoRoot, '.github', 'workflows', 'eval-chromatic.yml');
  await mkdir(dirname(workflowPath), { recursive: true });
  await writeFile(
    workflowPath,
    createChromaticWorkflow(project, workspace.repoRoot, workspace.projectPath)
  );
}

async function ensureGitIdentity(repoRoot: string) {
  const name = await x('git', ['config', 'user.name'], {
    throwOnError: false,
    nodeOptions: { cwd: repoRoot },
  });
  if (name.exitCode !== 0 || !name.stdout.trim()) {
    await x('git', ['config', 'user.name', 'Storybook Eval'], {
      nodeOptions: { cwd: repoRoot },
    });
  }

  const email = await x('git', ['config', 'user.email'], {
    throwOnError: false,
    nodeOptions: { cwd: repoRoot },
  });
  if (email.exitCode !== 0 || !email.stdout.trim()) {
    await x('git', ['config', 'user.email', 'storybook-eval@local'], {
      nodeOptions: { cwd: repoRoot },
    });
  }
}

function createChromaticWorkflow(project: Project, repoRoot: string, projectPath: string) {
  const runDirectory = relative(repoRoot, projectPath).replaceAll('\\', '/') || '.';

  return [
    'name: Eval Chromatic',
    '',
    'on:',
    '  pull_request:',
    '    types: [opened, synchronize, reopened]',
    '',
    'jobs:',
    '  chromatic:',
    '    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}',
    '    runs-on: ubuntu-latest',
    '    permissions:',
    '      contents: read',
    '      pull-requests: write',
    '',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          ref: ${{ github.event.pull_request.head.sha }}',
    '',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 22',
    '',
    '      - name: Install dependencies',
    '        shell: bash',
    '        run: |',
    '          if [ -f pnpm-lock.yaml ]; then',
    '            corepack enable',
    '            pnpm install --no-frozen-lockfile',
    '          elif [ -f yarn.lock ]; then',
    '            corepack enable',
    '            if [ -f .yarnrc.yml ]; then yarn install --no-immutable; else yarn install; fi',
    '          elif [ -f bun.lock ] || [ -f bun.lockb ]; then',
    '            curl -fsSL https://bun.sh/install | bash',
    '            export PATH="$HOME/.bun/bin:$PATH"',
    '            bun install',
    '          else',
    '            npm install --ignore-scripts',
    '          fi',
    '',
    '      - name: Run Chromatic',
    `        working-directory: ${runDirectory}`,
    '        env:',
    '          CHROMATIC_PROJECT_TOKEN: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}',
    '        run: npx chromatic --exit-zero-on-changes --diagnostics-file chromatic-diagnostics.json',
    '',
    '      - name: Upload eval summary',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: eval-summary',
    '          path: eval-results/summary.json',
    '          if-no-files-found: ignore',
    '',
    '      - name: Upload Chromatic diagnostics',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: chromatic-diagnostics',
    `          path: ${runDirectory}/chromatic-diagnostics.json`,
    '          if-no-files-found: ignore',
    '',
    '      - name: Comment Chromatic links',
    '        uses: actions/github-script@v7',
    '        with:',
    '          script: |',
    `            const repo = '${project.githubSlug}';`,
    "            const fs = require('node:fs');",
    `            const diagnosticsPath = '${runDirectory}/chromatic-diagnostics.json';`,
    '            if (!fs.existsSync(diagnosticsPath)) return;',
    "            const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));",
    `            const summaryUrl = 'https://github.com/${project.githubSlug}/blob/${'${{ github.head_ref }}'}/eval-results/summary.json';`,
    "            const marker = '<!-- storybook-eval-chromatic -->';",
    "            const body = [marker, '## Chromatic', '', `- Published Storybook: ${diagnostics.storybookUrl ?? 'n/a'}`, `- Build: ${diagnostics.webUrl ?? 'n/a'}`, `- Summary: ${summaryUrl}`].join('\\n');",
    '            const { data: comments } = await github.rest.issues.listComments({',
    '              owner: context.repo.owner,',
    '              repo: context.repo.repo,',
    '              issue_number: context.issue.number,',
    '            });',
    '            const existing = comments.find((comment) => comment.body?.includes(marker));',
    '            if (existing) {',
    '              await github.rest.issues.updateComment({',
    '                owner: context.repo.owner,',
    '                repo: context.repo.repo,',
    '                comment_id: existing.id,',
    '                body,',
    '              });',
    '            } else {',
    '              await github.rest.issues.createComment({',
    '                owner: context.repo.owner,',
    '                repo: context.repo.repo,',
    '                issue_number: context.issue.number,',
    '                body,',
    '              });',
    '            }',
    '',
  ].join('\n');
}

function createBlobUrl(repo: string, branch: string, filePath: string) {
  return `https://github.com/${repo}/blob/${branch}/${filePath}`;
}

function renderPrBody(opts: {
  branch: string;
  trialId: string;
  project: string;
  repo: string;
  prompt: string;
  score: number;
  summaryUrl: string;
  transcriptUrl: string;
  screenshots: ScreenshotArtifact[];
}) {
  const screenshotLines = opts.screenshots.length
    ? opts.screenshots
        .map((screenshot) => {
          const imageUrl = createBlobUrl(opts.repo, opts.branch, screenshot.imagePath);
          return `- \`${screenshot.storyFilePath}\` → [${screenshot.imagePath}](${imageUrl})`;
        })
        .join('\n')
    : '- No screenshots were generated.';

  return `# Eval Trial

- Trial ID: \`${opts.trialId}\`
- Project: \`${opts.project}\`
- Prompt: \`${opts.prompt}\`
- Score: \`${opts.score}\`
- Summary: [eval-results/summary.json](${opts.summaryUrl})
- Transcript: [eval-results/transcript.json](${opts.transcriptUrl})

## Screenshots

${screenshotLines}

## Chromatic

- Published Storybook: pending CI
- Build URL: pending CI
`;
}
