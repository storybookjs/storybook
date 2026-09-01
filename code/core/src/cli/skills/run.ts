import type { Options } from '../../types/index.ts';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { buildServerInstructions } from './content/build-server-instructions.ts';
import { buildStoryInstructions } from './content/build-story-instructions.ts';
import type { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { SKILLS, SKILL_IDS, isSkillId, type SkillId } from './content/skills.ts';
import type { SkillInputs, resolveSkillInputs } from './inputs.ts';
import type { ProjectInfoResult, getProjectInfo } from './project-info.ts';

export const SKILLS_OPTION_SPECS = [
  { flags: '--cwd <path>', description: 'Project directory of the target Storybook' },
  {
    flags: '-c, --config-dir <dir-name>',
    description: 'Storybook config directory of the target Storybook',
  },
  {
    flags: '-h, --help',
    description: 'Show every skill, or one skill with its description',
  },
] as const;

export type SkillsRunInput = {
  tokens: string[];
  help?: boolean;
  target: { cwd?: string; configDir?: string };
};

export type SkillsRunKind = 'help' | 'get';

export type SkillsRunResult = {
  output: string;
  errorOutput?: string;
  exitCode: number;
  kind: SkillsRunKind;
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

export type SkillsIntent =
  | { kind: 'catalog' }
  | { kind: 'skill-help'; id: SkillId }
  | { kind: 'get'; id: SkillId }
  | { kind: 'invalid'; tokens: string[] }
  | { kind: 'unknown'; id?: string };

export function resolveSkillsIntent(tokens: string[], help = false): SkillsIntent {
  const [first, second] = tokens;
  if (first === undefined) {
    return { kind: 'catalog' };
  }
  if (first === 'list') {
    return tokens.length === 1 ? { kind: 'catalog' } : { kind: 'invalid', tokens };
  }
  if (first !== 'get' && !isSkillId(first)) {
    return { kind: 'unknown', id: first };
  }
  if (tokens.length > (first === 'get' ? 2 : 1)) {
    return { kind: 'invalid', tokens };
  }
  const id = first === 'get' ? second : first;
  if (id === undefined || !isSkillId(id)) {
    return { kind: 'unknown', id };
  }
  return help ? { kind: 'skill-help', id } : { kind: 'get', id };
}

export async function runSkillsCommand(
  input: SkillsRunInput,
  deps: SkillsRunDeps
): Promise<SkillsRunResult> {
  const intent = resolveSkillsIntent(input.tokens, input.help);
  if (intent.kind === 'catalog') {
    return { output: renderCatalogHelp(), exitCode: 0, kind: 'help' };
  }
  if (intent.kind === 'skill-help') {
    return { output: renderSkillHelp(intent.id), exitCode: 0, kind: 'help', skill: intent.id };
  }
  if (intent.kind === 'invalid') {
    return {
      output: '',
      errorOutput: `Unexpected arguments: ${intent.tokens.map((token) => `"${token}"`).join(' ')}.`,
      exitCode: 1,
      kind: 'get',
    };
  }
  if (intent.kind === 'unknown') {
    return {
      output: '',
      errorOutput: `Unknown skill${intent.id ? ` "${intent.id}"` : ''}. Available skills: ${SKILL_IDS.join(', ')}.`,
      exitCode: 1,
      kind: 'get',
    };
  }

  const { id } = intent;

  if (id === 'setup') {
    // The setup skill only needs the lightweight project-info probe, not a full preset load, so
    // it never pays for `loadStorybook`. Resolve against `target.cwd` the same way the
    // config-loading branch below does — a relative `configDir` must not be probed against this
    // process's cwd when `--cwd` points the run at a different project.
    const probed: ProjectInfoResult = await deps.getProjectInfo({
      configDir: resolveStorybookConfigDir(input.target),
    });
    if (!probed.ok) {
      return { output: '', errorOutput: probed.message, exitCode: 1, kind: 'get', skill: id };
    }
    const { markdown } = await deps.getSetupMarkdown(probed.projectInfo);
    return { output: markdown, exitCode: 0, kind: 'get', skill: id };
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
      kind: 'get',
      skill: id,
    };
  }
  return { output: assemble(id, inputs), exitCode: 0, kind: 'get', skill: id };
}

function optionLines(): string[] {
  const column = Math.max(...SKILLS_OPTION_SPECS.map((spec) => spec.flags.length)) + 2;
  return SKILLS_OPTION_SPECS.map((spec) => `  ${spec.flags.padEnd(column)}${spec.description}`);
}

function skillLines(): string[] {
  const column = Math.max(...SKILL_IDS.map((id) => id.length)) + 2;
  return SKILL_IDS.map((id) => `  ${id.padEnd(column)}${SKILLS[id].blurb}`);
}

function renderCatalogHelp(): string {
  return [
    'Usage: npx storybook skills [options] [id]',
    '',
    'Agent skills served by this Storybook.',
    '',
    'Options:',
    ...optionLines(),
    '',
    'Skills:',
    ...skillLines(),
    '',
    'Print a skill with `npx storybook skills <id>`. `npx storybook skills <id> --help` shows one description.',
  ].join('\n');
}

function renderSkillHelp(id: SkillId): string {
  return [
    `Usage: npx storybook skills ${id} [options]`,
    '',
    SKILLS[id].blurb,
    '',
    'Prints the full instructions as markdown.',
    '',
    'Options:',
    ...optionLines(),
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
