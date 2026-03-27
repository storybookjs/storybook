import { readFileSync, existsSync, globSync } from "node:fs";
import { join, relative } from "node:path";
import type { SetupPattern } from "../types";

const RULES: Array<[id: string, label: string, pattern: RegExp]> = [
  ["global-css", "Global CSS import", /import\s+['"][^'"]+\.(css|scss|sass|less)['"]|import\s+['"]tailwindcss/],
  ["tailwind", "Tailwind CSS", /@tailwind|tailwindcss|tailwind\.css/],
  ["styled-components", "Styled Components", /styled-components|createGlobalStyle/],
  ["router-provider", "React Router", /MemoryRouter|BrowserRouter|RouterProvider/],
  ["redux-provider", "Redux Provider", /react-redux.*Provider|<Provider\s+store/],
  ["zustand", "Zustand", /from\s+['"]zustand['"]/],
  ["graphql", "GraphQL / Apollo", /ApolloProvider|MockedProvider|graphql|urql/],
  ["theme-provider", "Theme provider", /ThemeProvider|ChakraProvider/],
  ["vite-alias", "Vite alias config", /resolve:\s*\{[\s\S]*?alias/],
  ["static-dirs", "Static directories", /staticDirs/],
];

/** Scan .storybook/ config files for known setup patterns. */
export function detectSetupPatterns(projectPath: string): SetupPattern[] {
  const dir = join(projectPath, ".storybook");
  if (!existsSync(dir)) return [];

  const files = globSync("**/*", { cwd: dir }).map((f) => join(dir, f));
  const results: SetupPattern[] = [];

  for (const [id, label, pattern] of RULES) {
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
