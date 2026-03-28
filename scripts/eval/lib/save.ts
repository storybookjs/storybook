import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { x } from "tinyexec";

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
    evalBranch = (await x("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    evalCommit = (await x("git", ["rev-parse", "HEAD"])).stdout.trim();
  } catch {
    /* not in a git repo */
  }
  const env: Environment = { nodeVersion: process.version, evalBranch, evalCommit };
  await writeFile(join(resultsDir, "environment.json"), JSON.stringify(env, null, 2));
  return env;
}
