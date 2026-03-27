import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { TrialResult } from "../types";
import { logStep, logSuccess, logError, exec, EVAL_ROOT } from "./utils";

// Google Apps Script webhook URL for the Storybook Setup Eval spreadsheet.
// To set up your own: see google-apps-script.js in this directory.
const GOOGLE_SHEETS_URL = process.env.EVAL_GOOGLE_SHEETS_URL;

interface SheetsData {
  uploadId: string;
  runId: string;
  timestamp: string;
  project: string;
  agent: string;
  model: string;
  modelTier: string;
  promptFile: string;
  buildSuccess: boolean;
  typeCheckErrors: number;
  ghostStoriesPassed: number | null;
  ghostStoriesTotal: number | null;
  ghostStoriesRate: number | null;
  setupPatterns: string;
  changedFiles: number;
  storybookFiles: number;
  qualityScore: number;
  cost: number | "unknown";
  duration: number;
  turns: number;
  gitBranch: string;
  gitCommit: string;
  trialPath: string;
}

export interface Environment {
  nodeVersion: string;
  gitBranch: string;
  gitCommit: string;
  timestamp: string;
}

/**
 * Capture environment info for reproducibility.
 */
export async function captureEnvironment(resultsDir: string): Promise<Environment> {
  const nodeVersion = process.version;

  let gitBranch = "unknown";
  let gitCommit = "unknown";
  try {
    gitBranch = (await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    gitCommit = (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
  } catch {
    // Not in a git repo
  }

  const env: Environment = {
    nodeVersion,
    gitBranch,
    gitCommit,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(join(resultsDir, "environment.json"), JSON.stringify(env, null, 2));
  return env;
}

/**
 * Upload a trial result to Google Sheets.
 */
export async function saveToGoogleSheets(
  result: TrialResult,
  environment: Environment,
  runId: string,
  uploadId: string,
): Promise<void> {
  if (!GOOGLE_SHEETS_URL) {
    logStep("Skipping Google Sheets (set EVAL_GOOGLE_SHEETS_URL to enable)");
    return;
  }

  logStep("Uploading to Google Sheets...");

  const ghost = result.grading.ghostStories;
  const data: SheetsData = {
    uploadId,
    runId,
    timestamp: result.timestamp,
    project: result.project,
    agent: result.agent,
    model: result.model,
    modelTier: result.modelTier,
    promptFile: result.promptFile,
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
    gitBranch: environment.gitBranch,
    gitCommit: environment.gitCommit,
    trialPath: relative(EVAL_ROOT, ""),
  };

  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      redirect: "manual",
    });

    // Google Apps Script may return HTML on redirect — treat as success
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
