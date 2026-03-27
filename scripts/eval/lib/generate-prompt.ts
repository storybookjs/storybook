import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { PROMPTS_DIR } from "./utils.ts";

/**
 * Build a prompt by concatenating one or more markdown files from prompts/.
 *
 * Names are resolved as `prompts/{name}.md`. Multiple names are joined
 * with a blank line, so you can compose: `["setup", "self-heal"]`.
 *
 * If no names are given, defaults to `["setup"]`.
 */
export function generatePrompt(names?: string[]): string {
  const promptNames = names && names.length > 0 ? names : ["setup"];

  const parts: string[] = [];
  for (const name of promptNames) {
    const file = resolve(PROMPTS_DIR, `${name}.md`);
    if (!existsSync(file)) {
      throw new Error(`Prompt not found: ${file}\nAvailable: ${listPrompts().join(", ")}`);
    }
    parts.push(readFileSync(file, "utf-8").trim());
  }

  return parts.join("\n\n");
}

/**
 * List available prompt names (without .md extension).
 */
export function listPrompts(): string[] {
  if (!existsSync(PROMPTS_DIR)) return [];
  return readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"));
}
