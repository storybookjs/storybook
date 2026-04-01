import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
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

  await validateEvalSupportSetup({
    projectName: opts.project.name,
    projectPath: opts.workspace.projectPath,
    repoRoot: opts.workspace.repoRoot,
  });

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
  const existing = new Set(
    (
      await x('gh', ['label', 'list', '--repo', repo, '--limit', '200'], {
        nodeOptions: { cwd: process.cwd() },
      })
    ).stdout
      .split('\n')
      .map((line) => line.split('\t')[0]?.trim())
      .filter((label): label is string => Boolean(label))
  );

  for (const label of labels) {
    if (existing.has(label)) {
      continue;
    }

    await x(
      'gh',
      [
        'label',
        'create',
        label,
        '--repo',
        repo,
        '--description',
        `Automated eval label for ${label}`,
      ],
      { throwOnError: false }
    );
  }
}

async function validateEvalSupportSetup(opts: {
  projectName: string;
  projectPath: string;
  repoRoot: string;
}) {
  const missing: string[] = [];
  const configPath = await findStorybookMainFile(opts.projectPath);
  if (!configPath) {
    missing.push('.storybook/main.(ts|js|mts|mjs|cjs)');
  } else {
    const content = await readFile(configPath, 'utf-8');
    if (!content.includes('./eval-support/*.mdx')) {
      missing.push(`${relative(opts.projectPath, configPath) || '.storybook/main'} missing ./eval-support/*.mdx`);
    }
  }

  const supportDir = join(opts.projectPath, '.storybook', 'eval-support');
  for (const file of ['summary.mdx', 'transcript.mdx', 'transcript.tsx', 'transcript.types.ts']) {
    if (!existsSync(join(supportDir, file))) {
      missing.push(relative(opts.projectPath, join(supportDir, file)));
    }
  }

  for (const file of ['summary.json', 'transcript.json']) {
    if (!existsSync(join(opts.repoRoot, 'eval-results', file))) {
      missing.push(relative(opts.repoRoot, join(opts.repoRoot, 'eval-results', file)));
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Eval support is not configured for ${opts.projectName}. Missing: ${missing.join(', ')}`
    );
  }
}

async function findStorybookMainFile(projectPath: string) {
  const candidates = ['main.ts', 'main.js', 'main.mts', 'main.mjs', 'main.cjs'].map((file) =>
    join(projectPath, '.storybook', file)
  );
  return candidates.find((candidate) => existsSync(candidate));
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
`;
}
