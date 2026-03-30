import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SetupPattern } from '../types.ts';

const RULES = [
  {
    id: 'global-css',
    label: 'Global CSS import',
    pattern: /import\s+['"][^'"]+\.(css|scss|sass|less)['"]|import\s+['"]tailwindcss/,
  },
  { id: 'tailwind', label: 'Tailwind CSS', pattern: /@tailwind|tailwindcss|tailwind\.css/ },
  {
    id: 'styled-components',
    label: 'Styled Components',
    pattern: /styled-components|createGlobalStyle/,
  },
  {
    id: 'router-provider',
    label: 'React Router',
    pattern: /MemoryRouter|BrowserRouter|RouterProvider/,
  },
  {
    id: 'redux-provider',
    label: 'Redux Provider',
    pattern: /react-redux.*Provider|<Provider\s+store/,
  },
  { id: 'zustand', label: 'Zustand', pattern: /from\s+['"]zustand['"]/ },
  {
    id: 'graphql',
    label: 'GraphQL / Apollo',
    pattern: /ApolloProvider|MockedProvider|graphql|urql/,
  },
  { id: 'theme-provider', label: 'Theme provider', pattern: /ThemeProvider|ChakraProvider/ },
  { id: 'vite-alias', label: 'Vite alias config', pattern: /resolve:\s*\{[\s\S]*?alias/ },
  { id: 'static-dirs', label: 'Static directories', pattern: /staticDirs/ },
];

/** Scan .storybook/ config files for known setup patterns. */
export async function detectSetupPatterns(projectPath: string): Promise<SetupPattern[]> {
  const dir = join(projectPath, '.storybook');
  if (!existsSync(dir)) return [];

  // Read all entries recursively, then attempt to read each as a file
  const entries = await readdir(dir, { recursive: true });
  const fileContents = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry);
      try {
        return { path: fullPath, content: await readFile(fullPath, 'utf-8') };
      } catch {
        return null; // directories or unreadable files
      }
    })
  );

  const files = fileContents.filter((f): f is { path: string; content: string } => f !== null);

  const results: SetupPattern[] = [];
  for (const { id, label, pattern } of RULES) {
    const matches = files.filter((f) => pattern.test(f.content));
    if (matches.length > 0) {
      results.push({ id, label, sourceFiles: matches.map((f) => relative(projectPath, f.path)) });
    }
  }

  return results;
}
