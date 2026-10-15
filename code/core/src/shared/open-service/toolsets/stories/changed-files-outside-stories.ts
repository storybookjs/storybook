import { logger } from 'storybook/internal/node-logger';

import { basename, dirname, relative, resolve as resolvePath } from 'pathe';

import type { ChangedStoriesOutput, StoriesGitAccess, StorybookDirsAccess } from './definition.ts';
import type { ModuleGraphAccess } from './resolve-component-stories.ts';

const SOURCE_EXT_RE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/i;
const RENDERING_SOURCE_EXT_RE = /\.(?:tsx?|jsx?|vue|svelte)$/i;
const NON_RENDERING_CONFIG_FILE_RE = /^(?:main|manager)\./i;
const PREVIEW_ASSET_RE = /^preview-(?:head|body)\.html$|\.(?:css|scss|sass|less)$/i;
const TEST_OR_TYPES_FILE_RE = /\.(?:test|spec)\.[^/]+$|\.d\.[cm]?ts$/i;
const TOOL_CONFIG_FILE_RE = /\.config\.[^/]+$/i;
const STORY_FILE_RE = /\.stories\.[^/]+$/i;

// Bounds each reverse-index query on a large working tree.
const CHUNK_SIZE = 50;
const MAX_UNREACHABLE_FILES = 10;

export type ChangedFilesOutsideStories = Pick<
  ChangedStoriesOutput,
  'unreachableFiles' | 'unreachableFilesTruncated' | 'unindexedStoryFiles' | 'changedConfigFiles'
> & {
  /** Changed files that stories render, which change detection has to mark. */
  reachableFiles: string[];
};

function isWithin(file: string, dir: string): boolean {
  return dir === '' || file === dir || file.startsWith(`${dir}/`);
}

function isTestOrScriptPath(file: string, projectDir: string): boolean {
  const segments = file.split('/');
  const projectDepth = projectDir === '' ? 0 : projectDir.split('/').length;
  return (
    segments.includes('__tests__') ||
    segments[0] === 'scripts' ||
    (isWithin(file, projectDir) && segments[projectDepth] === 'scripts')
  );
}

function isRootLevel(file: string, root: string): boolean {
  const dir = dirname(file);
  return dir === '.' || dir === root;
}

// The changed files a story list cannot show: config-directory files apply to every story, and
// unreachable files could render but no story imports them. Paths stay repo-root-relative.
export async function detectChangedFilesOutsideStories({
  git,
  moduleGraph,
  storybookDirs,
}: {
  git: StoriesGitAccess;
  moduleGraph: ModuleGraphAccess;
  storybookDirs: StorybookDirsAccess;
}): Promise<ChangedFilesOutsideStories> {
  const none: ChangedFilesOutsideStories = {
    unreachableFiles: [],
    unreachableFilesTruncated: false,
    unindexedStoryFiles: [],
    changedConfigFiles: [],
    reachableFiles: [],
  };
  const status = await moduleGraph.queries.status.loaded(undefined);
  if (status.value !== 'ready') {
    return none;
  }

  let changedFiles: Awaited<ReturnType<StoriesGitAccess['getChangedFiles']>>;
  let repoRoot: string;
  try {
    [changedFiles, repoRoot] = await Promise.all([git.getChangedFiles(), git.getRepoRoot()]);
  } catch (error) {
    // Without git, change detection already answers "no changes detected"; this note must not turn
    // that into an error.
    logger.debug(`Changed-file detection skipped, git is unavailable: ${error}`);
    return none;
  }

  const configDir = relative(repoRoot, storybookDirs.configDir);
  const projectDir = dirname(configDir) === '.' ? '' : dirname(configDir);
  const staticDirs = (await storybookDirs.getStaticDirs()).map((dir) => relative(repoRoot, dir));
  const changedConfigFiles: string[] = [];
  const candidates: string[] = [];
  for (const file of new Set([...changedFiles.changed, ...changedFiles.new])) {
    if (staticDirs.some((dir) => dir !== '' && isWithin(file, dir))) {
      continue;
    }
    const name = basename(file);
    if (configDir !== '' && isWithin(file, configDir)) {
      const appliesToEveryStory =
        (SOURCE_EXT_RE.test(name) || PREVIEW_ASSET_RE.test(name)) &&
        !NON_RENDERING_CONFIG_FILE_RE.test(name) &&
        !TEST_OR_TYPES_FILE_RE.test(name);
      if (appliesToEveryStory) {
        changedConfigFiles.push(file);
      }
      continue;
    }
    const couldRender =
      RENDERING_SOURCE_EXT_RE.test(name) &&
      !TEST_OR_TYPES_FILE_RE.test(name) &&
      // Tooling configs sit at a package root; a deeper one can be runtime code, such as a theme.
      !(
        TOOL_CONFIG_FILE_RE.test(name) &&
        (isRootLevel(file, projectDir) || !isWithin(file, projectDir))
      ) &&
      !file.split('/').some((segment) => segment.startsWith('.') || segment === 'node_modules') &&
      !isTestOrScriptPath(file, projectDir);
    if (couldRender) {
      candidates.push(file);
    }
  }

  // Project files first, so other packages cannot crowd them out of the cap.
  candidates.sort((a, b) => Number(isWithin(b, projectDir)) - Number(isWithin(a, projectDir)));

  const unreachableFiles: string[] = [];
  const unindexedStoryFiles: string[] = [];
  const reachableFiles: string[] = [];
  for (
    let start = 0;
    start < candidates.length && unreachableFiles.length <= MAX_UNREACHABLE_FILES;
    start += CHUNK_SIZE
  ) {
    const chunk = candidates.slice(start, start + CHUNK_SIZE);
    // One batched lookup per chunk; the result is positional.
    const hits = await moduleGraph.queries.storiesForFiles.loaded({
      files: chunk.map((file) => resolvePath(repoRoot, file)),
    });
    for (const [position, file] of chunk.entries()) {
      if (unreachableFiles.length > MAX_UNREACHABLE_FILES) {
        break;
      }
      if ((hits[position]?.length ?? 0) > 0) {
        reachableFiles.push(file);
        continue;
      }
      // A story file renders itself, so it misses only while the index has not picked it up yet.
      if (STORY_FILE_RE.test(basename(file))) {
        unindexedStoryFiles.push(file);
      } else {
        unreachableFiles.push(file);
      }
    }
  }

  return {
    unreachableFiles: unreachableFiles.slice(0, MAX_UNREACHABLE_FILES),
    unreachableFilesTruncated: unreachableFiles.length > MAX_UNREACHABLE_FILES,
    unindexedStoryFiles,
    changedConfigFiles,
    reachableFiles,
  };
}
