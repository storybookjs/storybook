import { readFileSync, existsSync, globSync } from "node:fs";
import { join } from "node:path";
import type { GhostStoriesResult } from "../types";
import { logStep, logSuccess, logError, exec, cleanEnv } from "./utils";

/**
 * Run ghost stories: discover candidate components, auto-generate stories
 * via the addon-vitest componentTransform, and measure rendering success.
 */
export async function runGhostStories(
  projectPath: string,
  resultsDir: string,
): Promise<GhostStoriesResult | undefined> {
  logStep("Running ghost stories...");

  const candidates = findCandidates(projectPath);
  if (candidates.length === 0) {
    logError("No candidate components found");
    return undefined;
  }
  logStep(`Found ${candidates.length} candidate component(s)`);

  const reportPath = join(resultsDir, "ghost-stories-report.json");
  await exec(
    "npx",
    ["vitest", "run", "--project=storybook", "--reporter=json", `--outputFile=${reportPath}`, "--testTimeout=10000"],
    {
      cwd: projectPath,
      timeout: 120_000,
      throwOnError: false,
      env: { ...cleanEnv(), STORYBOOK_COMPONENT_PATHS: candidates.join(",") },
    },
  );

  if (!existsSync(reportPath)) {
    logError("Ghost stories: no Vitest report generated");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf-8"));
    let total = 0;
    let passed = 0;
    for (const suite of report.testResults ?? []) {
      for (const test of suite.assertionResults ?? []) {
        total++;
        if (test.status === "passed") passed++;
      }
    }
    const successRate = total > 0 ? Math.round((passed / total) * 100) / 100 : 0;
    if (total > 0) logSuccess(`Ghost stories: ${passed}/${total} passed (${Math.round(successRate * 100)}%)`);
    return { candidateCount: candidates.length, total, passed, successRate };
  } catch {
    logError("Ghost stories: failed to parse Vitest report");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }
}

/** Find .tsx/.jsx files that look like React components, sorted by simplicity. */
function findCandidates(projectPath: string): string[] {
  const SKIP = new Set(["node_modules", ".storybook", "dist", "build", ".git"]);
  const files = globSync("**/*.{tsx,jsx}", {
    cwd: projectPath,
    exclude: (f) => SKIP.has(f.name),
  });

  return files
    .filter((f) => !/\.(test|spec|stories|story)\./.test(f) && !/config\./.test(f))
    .map((f) => {
      try {
        const content = readFileSync(join(projectPath, f), "utf-8");
        if (!/export\s/.test(content)) return null;
        if (!/<[A-Z]/.test(content) && !/return\s*\(?\s*</.test(content)) return null;
        const lines = content.split("\n").filter((l) => l.trim()).length;
        return { path: f, complexity: Math.min(1, lines / 100) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.complexity - b!.complexity)
    .slice(0, 20)
    .map((c) => c!.path);
}
