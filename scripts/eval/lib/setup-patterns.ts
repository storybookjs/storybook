import { readFileSync, existsSync, globSync } from "node:fs";
import { join, relative } from "node:path";
import type { SetupPattern } from "../types.ts";

const RULES = [
  { id: "global-css", label: "Global CSS import", pattern: /import\s+['"][^'"]+\.(css|scss|sass|less)['"]|import\s+['"]tailwindcss/ },
  { id: "tailwind", label: "Tailwind CSS", pattern: /@tailwind|tailwindcss|tailwind\.css/ },
  { id: "styled-components", label: "Styled Components", pattern: /styled-components|createGlobalStyle/ },
  { id: "router-provider", label: "React Router", pattern: /MemoryRouter|BrowserRouter|RouterProvider/ },
  { id: "redux-provider", label: "Redux Provider", pattern: /react-redux.*Provider|<Provider\s+store/ },
  { id: "zustand", label: "Zustand", pattern: /from\s+['"]zustand['"]/ },
  { id: "graphql", label: "GraphQL / Apollo", pattern: /ApolloProvider|MockedProvider|graphql|urql/ },
  { id: "theme-provider", label: "Theme provider", pattern: /ThemeProvider|ChakraProvider/ },
  { id: "vite-alias", label: "Vite alias config", pattern: /resolve:\s*\{[\s\S]*?alias/ },
  { id: "static-dirs", label: "Static directories", pattern: /staticDirs/ },
];

/** Scan .storybook/ config files for known setup patterns. */
export function detectSetupPatterns(projectPath: string): SetupPattern[] {
  const dir = join(projectPath, ".storybook");
  if (!existsSync(dir)) return [];

  const files = globSync("**/*", { cwd: dir }).map((f) => join(dir, f));
  const results: SetupPattern[] = [];

  for (const { id, label, pattern } of RULES) {
    const matches = files.filter((f) => {
      try {
        return pattern.test(readFileSync(f, "utf-8"));
      } catch {
        return false;
      }
    });
    if (matches.length > 0) {
      results.push({ id, label, sourceFiles: matches.map((f) => relative(projectPath, f)) });
    }
  }

  return results;
}
