import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SetupPattern } from '../types';

interface PatternRule {
  id: string;
  label: string;
  /** Regex to match in file contents */
  pattern: RegExp;
  /** Only check files matching these extensions */
  extensions?: string[];
}

const RULES: PatternRule[] = [
  {
    id: 'global-css',
    label: 'Global CSS import',
    pattern: /import\s+['"][^'"]+\.(css|scss|sass|less)['"]|import\s+['"]tailwindcss/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    id: 'tailwind',
    label: 'Tailwind CSS',
    pattern: /@tailwind|tailwindcss|tailwind\.css/,
  },
  {
    id: 'styled-components',
    label: 'Styled Components',
    pattern: /styled-components|ThemeProvider.*styled|createGlobalStyle/,
  },
  {
    id: 'router-provider',
    label: 'React Router provider',
    pattern: /MemoryRouter|BrowserRouter|RouterProvider|createMemoryRouter/,
  },
  {
    id: 'redux-provider',
    label: 'Redux Provider',
    pattern: /react-redux.*Provider|<Provider\s+store/,
  },
  {
    id: 'zustand',
    label: 'Zustand store',
    pattern: /from\s+['"]zustand['"]/,
  },
  {
    id: 'graphql',
    label: 'GraphQL / Apollo',
    pattern: /ApolloProvider|MockedProvider|graphql|urql/,
  },
  {
    id: 'theme-provider',
    label: 'Theme provider',
    pattern: /ThemeProvider|MuiThemeProvider|ChakraProvider/,
  },
  {
    id: 'vite-alias',
    label: 'Vite alias config',
    pattern: /resolve:\s*\{[\s\S]*?alias/,
  },
  {
    id: 'static-dirs',
    label: 'Static directories',
    pattern: /staticDirs/,
  },
];

/**
 * Scan storybook config files for known setup patterns.
 */
export function detectSetupPatterns(projectPath: string): SetupPattern[] {
  const storybookDir = join(projectPath, '.storybook');
  if (!existsSync(storybookDir)) return [];

  const filesToScan = collectFiles(storybookDir);
  const results: SetupPattern[] = [];

  for (const rule of RULES) {
    const matches: string[] = [];
    for (const filePath of filesToScan) {
      if (rule.extensions && !rule.extensions.some((ext) => filePath.endsWith(ext))) {
        continue;
      }
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (rule.pattern.test(content)) {
          matches.push(relative(projectPath, filePath));
        }
      } catch {
        // skip unreadable files
      }
    }
    if (matches.length > 0) {
      results.push({ id: rule.id, label: rule.label, sourceFiles: matches });
    }
  }

  return results;
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(full));
      } else {
        files.push(full);
      }
    }
  } catch {
    // skip
  }
  return files;
}
