import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { PROMPTS_DIR } from "./utils.ts";

/** Load a prompt by name from prompts/{name}.md. Defaults to "setup". */
export function generatePrompt(name = "setup"): string {
  const file = resolve(PROMPTS_DIR, `${name}.md`);
  if (!existsSync(file)) {
    throw new Error(`Prompt not found: ${file}\nAvailable: ${listPrompts().join(", ")}`);
  }
  return readFileSync(file, "utf-8").trim();
}

/** List available prompt names. */
export function listPrompts(): string[] {
  if (!existsSync(PROMPTS_DIR)) return [];
  return readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"));
}
