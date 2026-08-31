import type { Options } from '../../types/index.ts';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { buildServerInstructions } from './content/build-server-instructions.ts';
import { buildStoryInstructions } from './content/build-story-instructions.ts';
import type { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { SKILLS, SKILL_IDS, isSkillId, type SkillId } from './content/skills.ts';
import type { SkillInputs, resolveSkillInputs } from './inputs.ts';
import type { ProjectInfoResult, getProjectInfo } from './project-info.ts';

export type SkillsRunInput = {
  subcommand: 'list' | 'get' | undefined;
  id?: string;
  target: { cwd?: string; configDir?: string };
};

export type SkillsRunResult = {
  output: string;
  errorOutput?: string;
  exitCode: number;
  /** For telemetry: which skill was served, when the run got that far. */
  skill?: SkillId;
};

export type SkillsRunDeps = {
  /**
   * `experimental_loadStorybook`, injected so this module stays testable without loading a real
   * Storybook configuration. Typed to the `Options` surface `resolveSkillInputs` consumes, so no
   * cast is needed at either call site.
   */
  loadStorybook: (args: { configDir: string }) => Promise<Options>;
  resolveSkillInputs: typeof resolveSkillInputs;
  getProjectInfo: typeof getProjectInfo;
  getSetupMarkdown: typeof getSetupMarkdownOutput;
};

export async function runSkillsCommand(
  input: SkillsRunInput,
  deps: SkillsRunDeps
): Promise<SkillsRunResult> {
  if (input.subcommand === undefined || input.subcommand === 'list') {
    return { output: renderList(), exitCode: 0 };
  }

  const { id } = input;
  if (id === undefined || !isSkillId(id)) {
    return {
      output: '',
      errorOutput: `Unknown skill${id ? ` "${id}"` : ''}. Available skills: ${SKILL_IDS.join(', ')}.`,
      exitCode: 1,
    };
  }

  if (id === 'setup') {
    // The setup skill only needs the lightweight project-info probe, not a full preset load, so
    // it never pays for `loadStorybook`. Resolve against `target.cwd` the same way the
    // config-loading branch below does — a relative `configDir` must not be probed against this
    // process's cwd when `--cwd` points the run at a different project.
    const probed: ProjectInfoResult = await deps.getProjectInfo({
      configDir: resolveStorybookConfigDir(input.target),
    });
    if (!probed.ok) {
      return { output: '', errorOutput: probed.message, exitCode: 1, skill: id };
    }
    const { markdown } = await deps.getSetupMarkdown(probed.projectInfo);
    return { output: markdown, exitCode: 0, skill: id };
  }

  const configDir = resolveStorybookConfigDir(input.target);
  let inputs: SkillInputs;
  try {
    const storybook = await deps.loadStorybook({ configDir });
    inputs = await deps.resolveSkillInputs(storybook);
  } catch (error) {
    // Reduce to one clean line, matching `cli/tools/run.ts`'s equivalent bootstrap failure: an
    // agent piping this output should not see a raw Node stack trace for an everyday "wrong
    // directory" mistake.
    return {
      output: '',
      errorOutput: `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`,
      exitCode: 1,
      skill: id,
    };
  }
  return { output: assemble(id, inputs), exitCode: 0, skill: id };
}

function renderList(): string {
  const column = Math.max(...SKILL_IDS.map((id) => id.length)) + 2;
  return [
    'Skills served by this Storybook. Read one with `npx storybook skills get <id>`.',
    '',
    ...SKILL_IDS.map((id) => `  ${id.padEnd(column)}${SKILLS[id].blurb}`),
  ].join('\n');
}

function assemble(id: Exclude<SkillId, 'setup'>, inputs: SkillInputs): string {
  // The CLI channel uses the CLI review gate (on by default), matching what the `storybook ai`
  // metadata path serves the plugins today — not the direct-MCP `reviewEnabled` gate.
  const reviewEnabled = inputs.reviewEnabledForCli;
  if (id === 'stories') {
    return buildServerInstructions({
      transport: 'cli',
      devEnabled: true,
      testSupported: inputs.testSupported,
      docsEnabled: inputs.docsEnabledForCli,
      changeDetectionEnabled: inputs.changeDetectionEnabled,
      moduleGraphSupported: inputs.moduleGraphSupported,
      reviewEnabled,
    });
  }
  return buildStoryInstructions({
    transport: 'cli',
    framework: inputs.framework,
    renderer: inputs.renderer,
    changeDetectionEnabled: inputs.changeDetectionEnabled,
    reviewEnabled,
    testSupported: inputs.testSupported,
    a11yEnabled: inputs.a11yEnabled,
    docsEnabled: inputs.docsEnabledForCli,
  });
}
