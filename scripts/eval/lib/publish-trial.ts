import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { x } from 'tinyexec';
import type { TrialWorkspace } from './prepare-trial.ts';
import type { EvalData } from './result-docs.ts';
import {
  formatCost,
  formatDuration,
  formatReadableUtcTimestamp,
  formatScore,
  getEvalResultsDir,
  getEvalResultsRelativePath,
  type Logger,
} from './utils.ts';

export interface PublishMetadata {
  branch: string;
  labels: string[];
  url: string;
}

export function buildTrialLabels(
  project: EvalData['project'],
  variant: EvalData['variant'],
  prompt: string
) {
  return [
    'eval',
    `project:${project.name}`,
    `agent:${variant.agent}`,
    `model:${variant.model}`,
    `effort:${variant.effort}`,
    `prompt:${prompt}`,
  ];
}

export async function publishTrialBranch(opts: {
  data: EvalData;
  workspace: TrialWorkspace;
  logger: Logger;
}) {
  const labels = buildTrialLabels(opts.data.project, opts.data.variant, opts.data.prompt.name);

  await validateEvalSupportSetup({
    projectName: opts.data.project.name,
    projectPath: opts.workspace.projectPath,
  });

  const prBody = renderPrBody({
    branch: opts.workspace.trialBranch,
    data: opts.data,
  });

  opts.logger.logStep('Creating trial commit...');
  await ensureGitIdentity(opts.workspace.repoRoot);
  await x('git', ['add', '-A'], {
    nodeOptions: { cwd: opts.workspace.repoRoot },
  });
  await x('git', ['commit', '--no-verify', '-m', `eval: ${opts.data.id}`], {
    nodeOptions: { cwd: opts.workspace.repoRoot },
  });

  opts.logger.logStep(`Pushing ${opts.workspace.trialBranch}...`);
  await x('git', ['push', '--set-upstream', 'origin', opts.workspace.trialBranch], {
    timeout: 120_000,
    nodeOptions: { cwd: opts.workspace.repoRoot },
  });

  await ensureLabels(opts.data.project.githubSlug, labels);

  opts.logger.logStep('Opening draft PR...');
  const title = `[eval] ${opts.data.project.name} ${opts.data.id}`;
  const prUrl = (
    await x(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        opts.data.project.githubSlug,
        '--base',
        opts.data.project.branch,
        '--head',
        opts.workspace.trialBranch,
        '--draft',
        '--title',
        title,
        '--body',
        prBody,
      ],
      { nodeOptions: { cwd: opts.workspace.repoRoot } }
    )
  ).stdout.trim();

  for (const label of labels) {
    await x(
      'gh',
      ['pr', 'edit', prUrl, '--repo', opts.data.project.githubSlug, '--add-label', label],
      {
        nodeOptions: { cwd: opts.workspace.repoRoot },
      }
    );
  }

  opts.logger.logSuccess(`Draft PR opened: ${prUrl}`);

  return {
    branch: opts.workspace.trialBranch,
    labels,
    url: prUrl,
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

async function validateEvalSupportSetup(opts: { projectName: string; projectPath: string }) {
  const missing: string[] = [];
  const configPath = await findStorybookMainFile(opts.projectPath);
  if (!configPath) {
    missing.push('.storybook/main.(ts|js|mts|mjs|cjs)');
  } else {
    const content = await readFile(configPath, 'utf-8');
    if (!content.includes('./eval-support/*.mdx')) {
      missing.push(
        `${relative(opts.projectPath, configPath) || '.storybook/main'} missing ./eval-support/*.mdx`
      );
    }
  }

  const supportDir = join(opts.projectPath, '.storybook', 'eval-support');
  for (const file of ['summary.mdx', 'transcript.mdx', 'transcript.tsx', 'transcript.types.ts']) {
    if (!existsSync(join(supportDir, file))) {
      missing.push(relative(opts.projectPath, join(supportDir, file)));
    }
  }

  const resultsDir = getEvalResultsDir(opts.projectPath);

  if (!existsSync(join(resultsDir, 'data.json'))) {
    missing.push(relative(opts.projectPath, join(resultsDir, 'data.json')));
  }

  for (const file of ['build-output.txt', 'typecheck-output.txt']) {
    if (!existsSync(join(resultsDir, file))) {
      missing.push(relative(opts.projectPath, join(resultsDir, file)));
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

function renderPrBody(opts: { branch: string; data: EvalData }) {
  const dataUrl = createBlobUrl(
    opts.data.project.githubSlug,
    opts.branch,
    getEvalResultsRelativePath('data.json', opts.data.project.projectDir)
  );
  const buildOutputUrl = createBlobUrl(
    opts.data.project.githubSlug,
    opts.branch,
    opts.data.artifacts.buildOutput.path
  );
  const typecheckOutputUrl = createBlobUrl(
    opts.data.project.githubSlug,
    opts.branch,
    opts.data.artifacts.typecheckOutput.path
  );
  const baselineGhostStories = formatGhostStories(opts.data.grade.baselineGhostStories);
  const postAgentGhostStories = formatGhostStories(opts.data.grade.ghostStories);
  const baselinePreviewStories = formatStoryRender(opts.data.grade.baselinePreviewStories);
  const postAgentStoryRender = formatStoryRender(opts.data.grade.storyRender);
  const lines = [
    '# Eval Trial',
    '',
    `- ID: \`${opts.data.id}\``,
    `- Created at: \`${formatReadableUtcTimestamp(opts.data.timestamp)}\``,
    `- Project: \`${opts.data.project.name}\``,
    `- Agent: \`${opts.data.variant.agent}\``,
    `- Model: \`${opts.data.variant.model}\``,
    `- Effort: \`${opts.data.variant.effort}\``,
    `- Prompt: \`${opts.data.prompt.name}\``,
    `- Score (preview gain): \`${formatScore(opts.data.score.score)}\``,
    `- Build: \`${opts.data.grade.buildSuccess ? 'PASS' : 'FAIL'}\``,
    `- TypeScript errors: \`${opts.data.grade.typeCheckErrors}\``,
    `- Ghost stories before: \`${baselineGhostStories}\``,
    `- Ghost stories after: \`${postAgentGhostStories}\``,
    `- Generated stories before: \`${baselinePreviewStories}\``,
    `- Generated stories after: \`${postAgentStoryRender}\``,
    `- Preview gain: \`${formatScore(opts.data.score.score)}\``,
    `- Duration: \`${formatDuration(opts.data.execution.duration)}\``,
    `- Cost: \`${formatCost(opts.data.execution.cost)}\``,
    `- Raw data: [${getEvalResultsRelativePath('data.json', opts.data.project.projectDir)}](${dataUrl})`,
  ];

  if (!opts.data.grade.buildSuccess) {
    lines.push(`- Build log: [${opts.data.artifacts.buildOutput.path}](${buildOutputUrl})`);
  }

  if (opts.data.grade.typeCheckErrors > 0) {
    lines.push(
      `- Typecheck log: [${opts.data.artifacts.typecheckOutput.path}](${typecheckOutputUrl})`
    );
  }

  lines.push(
    '',
    '<details>',
    '<summary>Full prompt</summary>',
    '',
    '```md',
    opts.data.prompt.content,
    '```',
    '</details>'
  );

  return lines.join('\n');
}

function formatStoryRender(storyRender?: EvalData['grade']['storyRender']) {
  if (!storyRender) {
    return '-';
  }

  const rate = storyRender.total > 0 ? storyRender.passed / storyRender.total : 0;
  return `${storyRender.passed}/${storyRender.total} (${Math.round(rate * 100)}%)`;
}

function formatGhostStories(ghost?: EvalData['grade']['ghostStories']) {
  if (!ghost) {
    return '-';
  }

  const rate = ghost.total > 0 ? ghost.passed / ghost.total : 0;
  return `${ghost.passed}/${ghost.total} (${Math.round(rate * 100)}%)`;
}
