import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrialResult } from "../types.ts";
import { logStep, logSuccess, logError, exec } from "./utils.ts";

const GOOGLE_SHEETS_URL = process.env.EVAL_GOOGLE_SHEETS_URL;

export interface Environment {
  nodeVersion: string;
  gitBranch: string;
  gitCommit: string;
}

export async function captureEnvironment(resultsDir: string): Promise<Environment> {
  let gitBranch = "unknown";
  let gitCommit = "unknown";
  try {
    gitBranch = (await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    gitCommit = (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
  } catch {
    /* not in a git repo */
  }
  const env = { nodeVersion: process.version, gitBranch, gitCommit };
  writeFileSync(join(resultsDir, "environment.json"), JSON.stringify(env, null, 2));
  return env;
}

export async function saveToGoogleSheets(
  result: TrialResult,
  env: Environment,
  runId: string,
  uploadId: string,
): Promise<void> {
  if (!GOOGLE_SHEETS_URL) {
    logStep("Skipping Google Sheets (set EVAL_GOOGLE_SHEETS_URL to enable)");
    return;
  }
  logStep("Uploading to Google Sheets...");

  const ghost = result.grading.ghostStories;
  const data = {
    uploadId,
    runId,
    timestamp: result.timestamp,
    project: result.project,
    agent: result.agent,
    model: result.model,
    modelTier: result.modelTier,
    prompts: result.prompts.join("+"),
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
    gitBranch: env.gitBranch,
    gitCommit: env.gitCommit,
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
        logError(`Google Sheets error: ${body.error}`);
        return;
      }
    }
    logSuccess("Uploaded to Google Sheets");
  } catch (error) {
    logError(`Google Sheets upload failed: ${error instanceof Error ? error.message : error}`);
  }
}
