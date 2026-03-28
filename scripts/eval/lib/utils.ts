import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import pc from "picocolors";
import type { Logger } from "../types.ts";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const EVAL_ROOT = resolve(REPO_ROOT, "..", "storybook-eval");
export const CACHE_DIR = resolve(EVAL_ROOT, ".cache", "repos");
export const TRIALS_DIR = resolve(EVAL_ROOT, "trials");
export const PROMPTS_DIR = resolve(import.meta.dirname, "..", "prompts");

// --- Logging ---

export function createLogger(prefix?: string): Logger {
  const p = prefix ? pc.dim(`[${prefix}]`) + " " : "";
  return {
    log: (msg: string) => console.log(`${p}${msg}`),
    logStep: (msg: string) => console.log(`${p}  ${pc.cyan(">")} ${msg}`),
    logSuccess: (msg: string) => console.log(`${p}  ${pc.green("✓")} ${msg}`),
    logError: (msg: string) => console.log(`${p}  ${pc.red("✗")} ${msg}`),
  };
}

// --- Formatting ---

export const formatDuration = (s: number) =>
  s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;

export const formatCost = (cost?: number) => (cost == null ? "-" : `$${cost.toFixed(2)}`);

export function generateTrialId(project: string, agent: string, model: string, prompt: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${ts}-${project}-${agent}-${model}-${prompt}-${crypto.randomUUID().slice(0, 8)}`;
}

// --- Prompts ---

/** Load a prompt by name from prompts/{name}.md, with optional template variables. */
export function generatePrompt(name = "setup", vars?: Record<string, string>): string {
  const file = resolve(PROMPTS_DIR, `${name}.md`);
  if (!existsSync(file)) {
    throw new Error(`Prompt not found: ${file}\nAvailable: ${listPrompts().join(", ")}`);
  }
  let content = readFileSync(file, "utf-8").trim();
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, value);
    }
  }
  return content;
}

/** List available prompt names. */
export function listPrompts(): string[] {
  if (!existsSync(PROMPTS_DIR)) return [];
  return readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"));
}

