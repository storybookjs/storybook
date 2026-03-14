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
): Promise<{
  candidates: string[];
  analyzedCount: number;
  avgComplexity: number;
}> {
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

  let selectedCandidates: { file: string; complexity: number }[] = [];

  // If we have enough simple candidates, use those
  if (simpleCandidates.length >= sampleCount) {
    selectedCandidates = simpleCandidates
      .sort((a, b) => a.complexity - b.complexity)
      .slice(0, sampleCount);
  } else {
    selectedCandidates = analyzedCandidates
      .sort((a, b) => a.complexity - b.complexity)
      .slice(0, sampleCount);
  }

  const avgComplexity =
    selectedCandidates.length > 0
      ? Number(
          (
            selectedCandidates.reduce((acc, curr) => acc + curr.complexity, 0) /
            selectedCandidates.length
          ).toFixed(2)
        )
      : 0;

  return {
    candidates: selectedCandidates.map(({ file }) => file),
    analyzedCount: analyzedCandidates.length,
    avgComplexity,
  };
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
  globMatchCount: number;
  analyzedCount?: number;
  avgComplexity?: number;
}> {
  let globMatchCount = 0;

  try {
    let files: string[] = [];

    // Find files matching the glob pattern
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
        '**/*.test.*',
        '**/*.d.*',
        '**/*.config.*',
        '**/*.spec.*',
        '**/*.stories.*',
        // skip example story files that come from the CLI
        '**/stories/{Button,Header,Page}.*',
        '**/stories/{button,header,page}.*',
      ],
    });

    globMatchCount = files.length;

    if (globMatchCount === 0) {
      return {
        candidates: [],
        globMatchCount,
      };
    }

    const { analyzedCount, avgComplexity, candidates } = await getCandidatesForStorybook(
      files,
      sampleSize
    );

    return {
      analyzedCount,
      avgComplexity,
      candidates,
      globMatchCount,
    };
  } catch {
    return {
      candidates: [],
      error: 'Failed to find candidates',
      globMatchCount,
    };
  }
}
