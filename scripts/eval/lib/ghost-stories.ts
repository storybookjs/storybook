/**
 * Ghost stories: discover component candidates and run vitest-based
 * ghost story tests to measure how many components render successfully.
 *
 * Self-contained — does not import from code/core. Uses the same vitest
 * + STORYBOOK_COMPONENT_PATHS approach that core-server uses internally,
 * but decoupled so eval has no cross-package source imports.
 */

import { existsSync } from "node:fs";
import { glob, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { x } from "tinyexec";

const COMPONENT_GLOB = "**/*.{tsx,jsx}";
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/__mocks__/**",
  "**/build/**",
  "**/storybook-static/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/*.story.*",
  "**/*.d.*",
  "**/*.config.*",
  "**/stories/{Button,Header,Page}.*",
  "**/stories/{button,header,page}.*",
];

export class GhostStoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhostStoryError";
  }
}

/**
 * Find component files that are candidates for ghost story testing.
 * Uses glob-based discovery — sufficient for eval grading purposes.
 */
export async function findComponentCandidates(opts: {
  cwd: string;
  sampleSize?: number;
}): Promise<string[]> {
  const { cwd, sampleSize = 20 } = opts;
  const files = await Array.fromAsync(glob(COMPONENT_GLOB, {
    cwd,
    exclude: IGNORE_PATTERNS,
  }));
  return files.map((file) => resolve(cwd, file)).slice(0, sampleSize);
}

export interface GhostStoryOutput {
  total: number;
  passed: number;
  successRate: number;
}

/**
 * Run ghost stories by executing vitest with STORYBOOK_COMPONENT_PATHS.
 *
 * The storybook vitest plugin auto-generates and tests stories for the
 * specified component files. Non-zero exit from vitest is expected when
 * some stories fail — we parse the JSON report for actual results.
 */
export async function runGhostStories(
  candidates: string[],
  opts: { cwd: string },
): Promise<GhostStoryOutput> {
  const outputFile = join(tmpdir(), `ghost-stories-${Date.now()}.json`);

  const result = await x("npx", [
    "vitest", "run",
    "--reporter=json",
    "--testTimeout=1000",
    `--outputFile=${outputFile}`,
    ...candidates,
  ], {
    throwOnError: false,
    timeout: 300_000,
    nodeOptions: {
      cwd: opts.cwd,
      env: {
        ...process.env,
        STORYBOOK_COMPONENT_PATHS: candidates.join(";"),
      },
    },
  });

  const stderr = (result.stderr ?? "").toLowerCase();
  if (stderr.includes("browsertype.launch")) {
    throw new GhostStoryError("Playwright not installed");
  }
  if (stderr.includes("no tests found")) {
    throw new GhostStoryError("No tests found");
  }

  if (!existsSync(outputFile)) {
    throw new GhostStoryError("JSON report not found");
  }

  let report: any;
  try {
    report = JSON.parse(await readFile(outputFile, "utf-8"));
  } catch {
    throw new GhostStoryError("Failed to parse vitest report");
  }

  if (!report.testResults?.length) {
    throw new GhostStoryError("No test results in report");
  }
  const total: number = report.numTotalTests ?? 0;
  const passed: number = report.numPassedTests ?? 0;
  const successRate = total > 0 ? Math.round((passed / total) * 100) / 100 : 0;
  return { total, passed, successRate };
}
