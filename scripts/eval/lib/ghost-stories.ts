import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GhostStoriesResult, Logger } from "../types.ts";
import { exec } from "./utils.ts";

// Core ghost-stories utilities — requires `yarn nx run-many -t compile` first.
import { getComponentCandidates } from "../../../code/core/src/core-server/utils/ghost-stories/get-candidates.ts";
import { parseVitestResults } from "../../../code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts";

/**
 * Run ghost stories: discover candidate components, auto-generate stories
 * via the addon-vitest componentTransform, and measure rendering success.
 */
export async function runGhostStories(
  projectPath: string,
  resultsDir: string,
  logger: Logger,
): Promise<GhostStoriesResult | undefined> {
  logger.logStep("Running ghost stories...");

  const { candidates, error } = await getComponentCandidates({ sampleSize: 20, cwd: projectPath });
  if (error || candidates.length === 0) {
    logger.logError(error ?? "No candidate components found");
    return undefined;
  }
  logger.logStep(`Found ${candidates.length} candidate component(s)`);

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
    logger.logError("Ghost stories: no Vitest report generated");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf-8"));
    const { summary } = parseVitestResults(report);
    if (!summary) {
      logger.logError("Ghost stories: no test results in Vitest report");
      return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
    }
    const { total, passed, successRate } = summary;
    if (total > 0)
      logger.logSuccess(`Ghost stories: ${passed}/${total} passed (${Math.round(successRate * 100)}%)`);
    return { candidateCount: candidates.length, total, passed, successRate };
  } catch {
    logger.logError("Ghost stories: failed to parse Vitest report");
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }
}
