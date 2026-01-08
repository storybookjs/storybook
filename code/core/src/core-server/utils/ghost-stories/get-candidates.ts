import { readFile } from 'node:fs/promises';

import { babelParse, traverse } from 'storybook/internal/babel';
import { logger } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

import { getComponentComplexity } from './component-analyzer';

// A valid candidate includes React code and at least one export
function isValidCandidate(source: string): boolean {
  const ast = babelParse(source);

  let hasJSX = false;
  let hasExport = false;

  traverse(ast, {
    JSXElement(path) {
      hasJSX = true;

      if (hasExport) {
        path.stop();
      }
    },
    JSXFragment(path) {
      hasJSX = true;

      if (hasExport) {
        path.stop();
      }
    },
    ExportNamedDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
    ExportDefaultDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
    ExportAllDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
  });

  return hasJSX && hasExport;
}

/**
 * Based on a list of files, analyze them to find potential candidates to generate story files for.
 * this is based on whether the file has JSX and exports and how many runtime LOC and imports it
 * has.
 */
export async function getCandidatesForStorybook(
  files: string[],
  sampleCount: number
): Promise<string[]> {
  const simpleCandidates: { file: string; complexity: number }[] = [];
  const analyzedCandidates: { file: string; complexity: number }[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = await readFile(file, 'utf-8');
      // filter out non-React code or files without exports
      if (!isValidCandidate(source)) {
        continue;
      }
    } catch {
      continue;
    }

    const complexity = getComponentComplexity(source);
    analyzedCandidates.push({ file, complexity });

    if (complexity < 0.3) {
      simpleCandidates.push({ file, complexity });
      if (simpleCandidates.length >= sampleCount) {
        break;
      }
    }
  }
  // If we have enough simple candidates, return them
  if (simpleCandidates.length >= sampleCount) {
    logger.debug(
      `Found ${simpleCandidates.length} enough simple candidates after analyzing ${analyzedCandidates.length} out of ${files.length} files`
    );
    return simpleCandidates
      .sort((a, b) => a.complexity - b.complexity)
      .map(({ file }) => file)
      .slice(0, sampleCount);
  }

  logger.debug(
    `Found ${simpleCandidates.length} simple and ${analyzedCandidates.length - simpleCandidates.length} complex candidates after analyzing ${analyzedCandidates.length} out of ${files.length} files`
  );
  // Otherwise, return all analyzed candidates
  return analyzedCandidates
    .sort((a, b) => a.complexity - b.complexity)
    .map(({ file }) => file)
    .slice(0, sampleCount);
}

export async function getComponentCandidates({
  sampleSize = 20,
  globPattern = '**/*.{tsx,jsx}',
}: {
  sampleSize?: number;
  globPattern?: string;
} = {}): Promise<{
  candidates: string[];
  error?: string;
  matchCount: number;
}> {
  logger.debug(`Starting story sampling with glob: ${globPattern}`);
  logger.debug(`Sample size: ${sampleSize}`);
  let matchCount = 0;

  try {
    let files: string[] = [];

    // Find files matching the glob pattern
    logger.debug('Finding files matching glob pattern...');
    files = await glob(globPattern, {
      cwd: process.cwd(),
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/__mocks__/**',
        '**/build/**',
        '**/storybook-static/**',
        '**/*.stories.*',
        '**/*.test.*',
        '**/*.d.*',
        '**/*.config.*',
        '**/*.spec.*',
      ],
    });

    logger.debug(`Found ${files.length} files matching glob pattern`);

    matchCount = files.length;

    const candidates = await getCandidatesForStorybook(files, sampleSize);
    logger.debug('candidates files:' + files.length);

    if (files.length === 0) {
      logger.warn(`No files found matching glob pattern: ${globPattern}`);
      return {
        candidates: [],
        matchCount,
      };
    }

    return {
      candidates,
      matchCount,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to find candidates: ${errorMessage}`);
    logger.debug(`Full error: ${error}`);
    return {
      candidates: [],
      error: errorMessage,
      matchCount,
    };
  }
}
