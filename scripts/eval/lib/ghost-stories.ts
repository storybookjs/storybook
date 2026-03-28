import { readFileSync, existsSync, globSync } from "node:fs";
import { join } from "node:path";
import type { GhostStoriesResult } from "../types.ts";
import { logStep, logSuccess, logError, exec } from "./utils.ts";

// component-analyzer has zero dependencies so it imports cleanly.
// parse-vitest-report can't be imported — its transitive imports use
// extensionless specifiers that fail under Node's native TS loader.
// We read numPassedTests/numTotalTests from the vitest JSON directly instead.
import { getComponentComplexity } from "../../../code/core/src/core-server/utils/ghost-stories/component-analyzer.ts";

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
    [
      "vitest", "run",
      "--reporter=json",
      `--outputFile=${reportPath}`,
      "--testTimeout=1000",
      ...candidates,
    ],
    {
      cwd: projectPath,
      timeout: 120_000,
      throwOnError: false,
      env: { ...process.env, STORYBOOK_COMPONENT_PATHS: candidates.join(";") },
    },
  );

  if (!existsSync(reportPath)) {
    logError("Ghost stories: no Vitest report generated");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf-8"));
    const total: number = report.numTotalTests ?? 0;
    const passed: number = report.numPassedTests ?? 0;
    if (total === 0) {
      logError("Ghost stories: no test results in Vitest report");
      return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
    }
    const successRate = parseFloat((passed / total).toFixed(2));
    logSuccess(`Ghost stories: ${passed}/${total} passed (${Math.round(successRate * 100)}%)`);
    return { candidateCount: candidates.length, total, passed, successRate };
  } catch {
    logError("Ghost stories: failed to parse Vitest report");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }
}

/**
 * Find .tsx/.jsx files that look like React components, sorted by complexity.
 * Uses getComponentComplexity from core for consistent scoring.
 */
export function findCandidates(projectPath: string): string[] {
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
        return { path: f, complexity: getComponentComplexity(content) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.complexity - b!.complexity)
    .slice(0, 20)
    .map((c) => c!.path);
}
