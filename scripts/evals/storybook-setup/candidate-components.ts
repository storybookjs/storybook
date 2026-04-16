import { readFile } from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

import type { CandidateComponent } from './types';

const DEFAULT_GLOB = '**/*.{tsx,jsx}';
const DEFAULT_SAMPLE_COUNT = 6;

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/storybook-static/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/*.story.*',
  '**/*.config.*',
  '**/*.d.*',
  '**/__mocks__/**',
  '**/stories/{Button,Header,Page}.*',
  '**/stories/{button,header,page}.*',
  '**/src/stories/{Button,Header,Page}.*',
  '**/src/stories/{button,header,page}.*',
];

function looksLikeReactComponent(source: string) {
  const hasExport = /\bexport\s+(default|const|function|class|\{)/.test(source);
  const hasJsx = /<[A-Za-z][^>]*>/.test(source) || /return\s*\(\s*</.test(source);
  return hasExport && hasJsx;
}

function getComplexity(source: string) {
  const lines = source.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length;
  const importCount = lines.filter((line) => line.trim().startsWith('import ')).length;
  const rawComplexity = nonEmptyLines + importCount * 0.5;
  const normalized = rawComplexity / (32 / 0.3);
  return Number(Math.min(normalized, 1).toFixed(2));
}

export async function selectCandidateComponents(
  cwd: string,
  sampleCount = DEFAULT_SAMPLE_COUNT
): Promise<CandidateComponent[]> {
  const files = await glob(DEFAULT_GLOB, {
    cwd,
    absolute: true,
    ignore: IGNORE_PATTERNS,
  });

  const candidates: CandidateComponent[] = [];
  for (const filePath of files) {
    try {
      const source = await readFile(filePath, 'utf8');
      if (!looksLikeReactComponent(source)) {
        continue;
      }

      candidates.push({
        path: filePath,
        complexity: getComplexity(source),
      });
    } catch {}
  }

  return candidates.sort((left, right) => left.complexity - right.complexity).slice(0, sampleCount);
}
