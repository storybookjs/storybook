import { existsSync } from 'node:fs';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { x } from 'tinyexec';
import type { FileChange } from './grade.ts';
import type { Logger } from './utils.ts';

const STORY_FILE_PATTERN = /\.(stories|story)\.[tj]sx?$/;
const SCREENSHOT_SUFFIX = '.chromium.png';

export interface ScreenshotArtifact {
  storyFilePath: string;
  exportName: string;
  imagePath: string;
}

export interface ScreenshotRunResult {
  screenshots: ScreenshotArtifact[];
  attempted: boolean;
  success: boolean;
}

export function getChangedStoryFiles(repoRoot: string, fileChanges: FileChange[]): string[] {
  return fileChanges
    .filter((change) => change.gitStatus !== 'D' && STORY_FILE_PATTERN.test(change.path))
    .map((change) => resolve(repoRoot, change.path));
}

export async function runStorybookScreenshots(opts: {
  projectPath: string;
  repoRoot: string;
  resultsDir: string;
  fileChanges: FileChange[];
  logger: Logger;
}) {
  const storyFiles = getChangedStoryFiles(opts.repoRoot, opts.fileChanges);
  if (storyFiles.length === 0) {
    return {
      screenshots: [] as ScreenshotArtifact[],
      attempted: false,
      success: true,
    };
  }

  await clearExistingScreenshots(storyFiles);
  const runnableStoryFiles = storyFiles
    .map((storyFile) => relative(opts.projectPath, storyFile))
    .filter((storyFile) => storyFile !== '' && !storyFile.startsWith('..'));

  if (runnableStoryFiles.length === 0) {
    opts.logger.logStep(
      'No changed story files live under the evaluated project path; skipping screenshots.'
    );
    return {
      screenshots: [] as ScreenshotArtifact[],
      attempted: false,
      success: true,
    };
  }

  opts.logger.logStep(`Generating screenshots for ${runnableStoryFiles.length} story file(s)...`);
  const result = await x('npx', ['vitest', 'run', '--project=storybook', ...runnableStoryFiles], {
    throwOnError: false,
    timeout: 300_000,
    nodeOptions: {
      cwd: opts.projectPath,
      env: {
        ...process.env,
        STORYBOOK_DISABLE_TELEMETRY: '1',
        STORYBOOK_TEST_SCREENSHOTS: 'true',
      },
    },
  });

  const output = `${result.stdout}\n${result.stderr}`.trim();
  await writeFile(join(opts.resultsDir, 'screenshot-output.txt'), output);

  if (result.exitCode !== 0) {
    opts.logger.logError(`Screenshot pass failed (exit ${result.exitCode})`);
  } else {
    opts.logger.logSuccess('Screenshot pass completed');
  }

  return {
    screenshots: await collectScreenshotArtifacts(opts.repoRoot, storyFiles),
    attempted: true,
    success: result.exitCode === 0,
  } satisfies ScreenshotRunResult;
}

export async function collectScreenshotArtifacts(repoRoot: string, storyFiles: string[]) {
  const artifacts: ScreenshotArtifact[] = [];

  for (const storyFilePath of storyFiles) {
    const directory = dirname(storyFilePath);
    const filePrefix = `${basename(storyFilePath, extname(storyFilePath))}.`;
    if (!existsSync(directory)) {
      continue;
    }

    const files = await readdir(directory);
    for (const file of files) {
      if (!file.startsWith(filePrefix) || !file.endsWith(SCREENSHOT_SUFFIX)) {
        continue;
      }

      const exportName = file
        .slice(filePrefix.length, -SCREENSHOT_SUFFIX.length)
        .replace(/-+/g, '-');
      artifacts.push({
        storyFilePath: relative(repoRoot, storyFilePath),
        exportName,
        imagePath: relative(repoRoot, join(directory, file)),
      });
    }
  }

  return artifacts.sort((a, b) => a.imagePath.localeCompare(b.imagePath));
}

async function clearExistingScreenshots(storyFiles: string[]) {
  await Promise.all(
    storyFiles.map(async (storyFilePath) => {
      const directory = dirname(storyFilePath);
      if (!existsSync(directory)) {
        return;
      }

      const filePrefix = `${basename(storyFilePath, extname(storyFilePath))}.`;
      const files = await readdir(directory);
      await Promise.all(
        files
          .filter((file) => file.startsWith(filePrefix) && file.endsWith(SCREENSHOT_SUFFIX))
          .map((file) => rm(join(directory, file), { force: true }))
      );
    })
  );
}
