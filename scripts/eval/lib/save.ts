import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrialResult, Logger } from "../types.ts";
import { exec } from "./utils.ts";

const GOOGLE_SHEETS_URL = process.env.EVAL_GOOGLE_SHEETS_URL;

export interface Environment {
  nodeVersion: string;
  /** Git branch of the eval harness (storybook monorepo), not the evaluated project. */
  evalBranch: string;
  /** Git commit of the eval harness (storybook monorepo), not the evaluated project. */
  evalCommit: string;
}

export async function captureEnvironment(resultsDir: string): Promise<Environment> {
  let evalBranch = "unknown";
  let evalCommit = "unknown";
  try {
    evalBranch = (await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    evalCommit = (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
  } catch {
    /* not in a git repo */
  }
  const env: Environment = { nodeVersion: process.version, evalBranch, evalCommit };
  writeFileSync(join(resultsDir, "environment.json"), JSON.stringify(env, null, 2));
  return env;
}

export async function saveToGoogleSheets(
  result: TrialResult,
  env: Environment,
  runId: string,
  uploadId: string,
  logger: Logger,
): Promise<void> {
  if (!GOOGLE_SHEETS_URL) {
    logger.logStep("Skipping Google Sheets (set EVAL_GOOGLE_SHEETS_URL to enable)");
    return;
  }
  logger.logStep("Uploading to Google Sheets...");

  const ghost = result.grading.ghostStories;
  const data = {
    uploadId,
    runId,
    timestamp: result.timestamp,
    project: result.project,
    agent: result.agent,
    model: result.model,
    effort: result.effort,
    prompt: result.prompt,
    buildSuccess: result.grading.buildSuccess,
    typeCheckErrors: result.grading.typeCheckErrors,
    ghostStoriesPassed: ghost?.passed ?? null,
    ghostStoriesTotal: ghost?.total ?? null,
    ghostStoriesRate: ghost?.successRate ?? null,
    setupPatterns: result.grading.setupPatterns.map((p) => p.id).join(", "),
    changedFiles: result.grading.changedFiles.length,
    storybookFiles: result.grading.storybookFiles.length,
    qualityScore: result.quality.score,
    cost: result.execution.cost ?? "unknown",
    duration: result.execution.duration,
    turns: result.execution.turns,
    evalBranch: env.evalBranch,
    evalCommit: env.evalCommit,
  };

  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      redirect: "manual",
    });
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = (await response.json()) as { success: boolean; error?: string };
      if (!body.success) {
        logger.logError(`Google Sheets error: ${body.error}`);
        return;
      }
    }
    logger.logSuccess("Uploaded to Google Sheets");
  } catch (error) {
    logger.logError(`Google Sheets upload failed: ${error instanceof Error ? error.message : error}`);
  }
}
