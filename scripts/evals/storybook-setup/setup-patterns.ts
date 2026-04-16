import { readFile } from 'node:fs/promises';

import type { SetupPattern } from './types';

const PATTERN_RULES = [
  {
    id: 'global-css',
    label: 'Global CSS import',
    pattern: /import\s+['"].+\.(css|scss|sass|less)['"]/,
  },
  {
    id: 'router-provider',
    label: 'Router provider/decorator',
    pattern: /react-router-dom|MemoryRouter|RouterProvider/,
  },
  {
    id: 'redux-provider',
    label: 'Redux provider/decorator',
    pattern: /react-redux|<Provider\b|configureStore|createStore/,
  },
  {
    id: 'styled-components',
    label: 'Styled-components theme or globals',
    pattern: /styled-components|createGlobalStyle|ThemeProvider/,
  },
  {
    id: 'tailwind',
    label: 'Tailwind pipeline or stylesheet',
    pattern: /tailwind|@tailwind|tailwindcss/,
  },
  {
    id: 'headlessui',
    label: 'Headless UI integration',
    pattern: /@headlessui\/react/,
  },
  {
    id: 'graphql',
    label: 'GraphQL/Apollo provider or mocks',
    pattern: /apollo|graphql|MockedProvider|urql|relay/,
  },
  {
    id: 'zustand',
    label: 'Zustand state wiring',
    pattern: /zustand/,
  },
  {
    id: 'vite-alias',
    label: 'Vite alias or builder config',
    pattern: /viteFinal|resolve:\s*\{|alias:/,
  },
  {
    id: 'theme-provider',
    label: 'App theme provider',
    pattern: /\bThemeProvider\b|theme:/,
  },
];

export async function detectSetupPatterns(
  repoRoot: string,
  candidateFiles: string[]
): Promise<SetupPattern[]> {
  const patternMap = new Map<string, SetupPattern>();
  const uniqueFiles = Array.from(new Set(candidateFiles));

  for (const filePath of uniqueFiles) {
    try {
      const source = await readFile(filePath, 'utf8');
      const relativePath = filePath.startsWith(repoRoot)
        ? filePath.slice(repoRoot.length + 1)
        : filePath;

      for (const rule of PATTERN_RULES) {
        if (!rule.pattern.test(source)) {
          continue;
        }

        const existing = patternMap.get(rule.id);
        if (existing) {
          if (!existing.sourceFiles.includes(relativePath)) {
            existing.sourceFiles.push(relativePath);
          }
          continue;
        }

        patternMap.set(rule.id, {
          id: rule.id,
          label: rule.label,
          sourceFiles: [relativePath],
        });
      }
    } catch {}
  }

  return Array.from(patternMap.values()).sort((left, right) => left.id.localeCompare(right.id));
}
