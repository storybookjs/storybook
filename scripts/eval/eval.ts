/**
 * Eval harness entry point — single or parallel trial runs.
 *
 * Runs with `node ./eval/eval.ts` (no jiti). Node 22+ supports .ts natively
 * via type stripping. Import specifiers use explicit .ts extensions.
 *
 * Usage:
 *   node eval/eval.ts -p mealdrop                         # single run (claude, default model)
 *   node eval/eval.ts -p mealdrop -m gpt-5.4              # single run (agent inferred from model)
 *   node eval/eval.ts -p mealdrop -m sonnet-4.6,gpt-5.4   # parallel runs
 *   node eval/eval.ts -p mealdrop -a claude,codex          # parallel runs (default model each)
 *   node eval/eval.ts --list-projects                      # list projects
 *   node eval/eval.ts --list-models                        # list models
 *   node eval/eval.ts --list-prompts                       # list prompts
 */
import { defineCommand, runMain } from "citty";
import { randomUUID } from "node:crypto";
import pc from "picocolors";
import type { AgentName, TrialConfig, TrialResult } from "./types.ts";
import { AGENTS, PROJECTS } from "./config.ts";
import { runTask } from "./lib/run-task.ts";
import { createLogger, formatDuration, formatCost, formatTable, listPrompts } from "./lib/utils.ts";

const main = defineCommand({
  meta: {
    name: "eval",
    description: "Storybook setup eval harness — measure AI agent quality on real-world projects",
  },
  args: {
    project: { type: "string", alias: "p", description: "Project name" },
    agent: { type: "string", alias: "a", description: "Agent(s), comma-separated" },
    model: { type: "string", alias: "m", description: "Model(s), comma-separated" },
    effort: { type: "string", alias: "e", description: "Effort level" },
    prompt: { type: "string", description: "Prompt name", default: "setup" },
    verbose: { type: "boolean", alias: "v", description: "Verbose output", default: false },
    listProjects: { type: "boolean", description: "List available projects", default: false },
    listModels: { type: "boolean", description: "List available models", default: false },
    listPrompts: { type: "boolean", description: "List available prompts", default: false },
  },
  async run({ args }) {
    const logger = createLogger();

    // --- List commands ---

    if (args.listProjects) {
      for (const p of PROJECTS) logger.log(`  ${pc.bold(p.name)} — ${p.description}`);
      return;
    }
    if (args.listModels) {
      for (const [agent, { models }] of Object.entries(AGENTS)) {
        logger.log(`\n  ${pc.bold(agent)}`);
        for (const m of models) logger.log(`    ${m}`);
      }
      return;
    }
    if (args.listPrompts) {
      for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
      return;
    }

    // --- Validate project ---

    const project = PROJECTS.find((p) => p.name === args.project);
    if (!project) {
      logger.log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
      process.exit(1);
    }

    // --- Build configs (supports comma-separated values for parallel runs) ---

    const promptNames = args.prompt!.split(",");
    const allModels = Object.values(AGENTS).flatMap((cfg) => cfg.models);

    // Determine agent → model pairs
    let agentModels: Array<{ agent: AgentName; model: string }>;

    if (args.model) {
      // Models specified — infer agent per model
      agentModels = args.model.split(",").map((model) => {
        const entry = Object.entries(AGENTS).find(([, cfg]) => cfg.models.includes(model));
        if (!entry) {
          logger.log(pc.red(`Unknown model: ${model}. Available: ${allModels.join(", ")}`));
          process.exit(1);
        }
        return { agent: entry[0] as AgentName, model };
      });
      // If --agent is also specified, filter to matching agents
      if (args.agent) {
        const filter = args.agent.split(",");
        agentModels = agentModels.filter((am) => filter.includes(am.agent));
      }
    } else if (args.agent) {
      // Agents specified — use default model per agent
      agentModels = args.agent.split(",").map((name) => {
        const cfg = AGENTS[name as AgentName];
        if (!cfg) {
          logger.log(pc.red(`Unknown agent: ${name}. Options: ${Object.keys(AGENTS).join(", ")}`));
          process.exit(1);
        }
        return { agent: name as AgentName, model: cfg.defaultModel };
      });
    } else {
      // Default: single claude run
      agentModels = [{ agent: "claude", model: AGENTS.claude.defaultModel }];
    }

    // Expand to full configs: agent×model × prompt
    const configs = agentModels.flatMap(({ agent, model }) => {
      const cfg = AGENTS[agent];
      const effort = args.effort ?? cfg.defaultEffort;
      if (!cfg.efforts.includes(effort)) {
        logger.log(pc.red(`Unknown effort "${effort}" for ${agent}. Available: ${cfg.efforts.join(", ")}`));
        process.exit(1);
      }
      return promptNames.map((prompt) => ({
        config: { project, agent, model, effort, prompt, verbose: args.verbose } as TrialConfig,
        label: `${model}+${prompt}`,
      }));
    });

    if (configs.length === 0) {
      logger.log(pc.red("No matching agent/model/prompt combinations found."));
      process.exit(1);
    }

    // --- Print header ---

    const runId = randomUUID().slice(0, 8);
    logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
    if (configs.length === 1) {
      const { agent, model, effort, prompt } = configs[0].config;
      logger.log(`Agent: ${agent} | Model: ${model} | Effort: ${effort} | Prompt: ${prompt}`);
    } else {
      logger.log(`${configs.length} parallel runs`);
      for (const [agent, { models }] of Object.entries(AGENTS)) {
        const active = models.filter((m) => configs.some((c) => c.config.model === m));
        if (active.length > 0) logger.log(`  ${agent}: ${active.join(", ")}`);
      }
      logger.log(`  prompts: ${[...new Set(promptNames)].join(", ")}`);
    }
    logger.log(`Run: ${runId}\n`);

    // --- Execute (always use allSettled — works for 1 or N runs) ---

    const settled = await Promise.allSettled(
      configs.map((c) => runTask(c.config, createLogger(configs.length > 1 ? c.label : undefined))),
    );

    const results: TrialResult[] = [];
    for (const [i, s] of settled.entries()) {
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
        logger.logError(`${configs[i].label}: ${s.reason instanceof Error ? s.reason.message : s.reason}`);
      }
    }

    if (results.length === 0) {
      process.exit(1);
    }

    // --- Print results ---

    if (results.length === 1) {
      const r = results[0];
      const ghost = r.grading.ghostStories;
      const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";

      logger.log(pc.bold("\nResult"));
      logger.log(`  Build:   ${r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL")}`);
      logger.log(`  Ghost:   ${ghostStr}`);
      logger.log(`  TS Err:  ${r.grading.typeCheckErrors}`);
      logger.log(`  Score:   ${r.quality.score}`);
      logger.log(`  Cost:    ${formatCost(r.execution.cost)}`);
      logger.log(`  Time:    ${formatDuration(r.execution.duration)}`);
      logger.log(`  Turns:   ${r.execution.turns}`);
    } else {
      results.sort((a, b) => (b.grading.ghostStories?.successRate ?? -1) - (a.grading.ghostStories?.successRate ?? -1));

      const headers = ["Agent", "Model", "Prompt", "Build", "Ghost", "TS Err", "Score", "Cost", "Time", "Turns"];
      const rows = results.map((r) => {
        const ghost = r.grading.ghostStories;
        const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
        return [
          r.agent,
          r.model,
          r.prompt,
          r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL"),
          ghostStr,
          String(r.grading.typeCheckErrors),
          String(r.quality.score),
          formatCost(r.execution.cost),
          formatDuration(r.execution.duration),
          String(r.execution.turns),
        ];
      });

      logger.log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
      logger.log(formatTable(headers, rows));

      const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
      const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r): r is number => r != null);
      const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

      logger.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
      logger.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
    }

    logger.log("\nDone.");
  },
});

runMain(main);
