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
  { flags: '--all', description: 'Print every skill in full' },
  {
    flags: '-h, --help',
    description: 'Show every skill, or one skill with its description',
  },
] as const;

type SkillsOptionSpec = (typeof SKILLS_OPTION_SPECS)[number];

export type SkillsRunInput = {
  tokens: string[];
  help?: boolean;
  all?: boolean;
  target: SkillsTarget;
};

type SkillsTarget = { cwd?: string; configDir?: string };

export type SkillsRunKind = 'help' | 'get';

export type SkillsRunResult = {
  output: string;
  errorOutput?: string;
  exitCode: number;
  kind: SkillsRunKind;
  /** For telemetry: which skill was served (or `all`), when the run got that far. */
  skill?: SkillId | 'all';
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
  | { kind: 'all' }
  | { kind: 'invalid'; tokens: string[] }
  | { kind: 'unknown'; id: string };

export function resolveSkillsIntent(
  tokens: string[],
  { help = false, all = false }: { help?: boolean; all?: boolean } = {}
): SkillsIntent {
  const [id, ...rest] = tokens;
  if (id === undefined) {
    return all && !help ? { kind: 'all' } : { kind: 'catalog' };
  }
  if (!isSkillId(id)) {
    return { kind: 'unknown', id };
  }
  if (rest.length > 0 || all) {
    return { kind: 'invalid', tokens };
  }
  return help ? { kind: 'skill-help', id } : { kind: 'get', id };
}

export async function runSkillsCommand(
  input: SkillsRunInput,
  deps: SkillsRunDeps
): Promise<SkillsRunResult> {
  const intent = resolveSkillsIntent(input.tokens, input);
  if (intent.kind === 'catalog') {
    return { output: renderCatalogHelp(), exitCode: 0, kind: 'help' };
  }
  if (intent.kind === 'skill-help') {
    return { output: renderSkillHelp(intent.id), exitCode: 0, kind: 'help', skill: intent.id };
  }
  if (intent.kind === 'invalid') {
    return failure(
      `Unexpected arguments: ${intent.tokens.map((token) => `"${token}"`).join(' ')}. Run \`npx storybook skills --help\` for usage.`
    );
  }
  if (intent.kind === 'unknown') {
    return failure(`Unknown skill "${intent.id}". Available skills: ${SKILL_IDS.join(', ')}.`);
  }
  if (intent.kind === 'all') {
    const setup = await serveSetup(input.target, deps);
    if (!setup.ok) {
      return failure(setup.message, 'all');
    }
    const loaded = await loadInputs(input.target, deps);
    if (!loaded.ok) {
      return failure(loaded.message, 'all');
    }
    const output = SKILL_IDS.map((id) =>
      id === 'setup' ? setup.markdown : assemble(id, loaded.inputs)
    ).join('\n\n---\n\n');
    return { output, exitCode: 0, kind: 'get', skill: 'all' };
  }

  const { id } = intent;
  if (id === 'setup') {
    const setup = await serveSetup(input.target, deps);
    return setup.ok
      ? { output: setup.markdown, exitCode: 0, kind: 'get', skill: id }
      : failure(setup.message, id);
  }
  const loaded = await loadInputs(input.target, deps);
  return loaded.ok
    ? { output: assemble(id, loaded.inputs), exitCode: 0, kind: 'get', skill: id }
    : failure(loaded.message, id);
}

function failure(message: string, skill?: SkillId | 'all'): SkillsRunResult {
  return { output: '', errorOutput: message, exitCode: 1, kind: 'get', skill };
}

// The setup skill only needs the lightweight project-info probe, not a full preset load, so it
// never pays for `loadStorybook`. Resolve against `target.cwd` the same way `loadInputs` does — a
// relative `configDir` must not be probed against this process's cwd when `--cwd` points the run
// at a different project.
async function serveSetup(
  target: SkillsTarget,
  deps: SkillsRunDeps
): Promise<{ ok: true; markdown: string } | { ok: false; message: string }> {
  const probed: ProjectInfoResult = await deps.getProjectInfo({
    configDir: resolveStorybookConfigDir(target),
  });
  if (!probed.ok) {
    return { ok: false, message: probed.message };
  }
  const { markdown } = await deps.getSetupMarkdown(probed.projectInfo);
  return { ok: true, markdown };
}

async function loadInputs(
  target: SkillsTarget,
  deps: SkillsRunDeps
): Promise<{ ok: true; inputs: SkillInputs } | { ok: false; message: string }> {
  try {
    const storybook = await deps.loadStorybook({ configDir: resolveStorybookConfigDir(target) });
    return { ok: true, inputs: await deps.resolveSkillInputs(storybook) };
  } catch (error) {
    // Reduce to one clean line, matching `cli/tools/run.ts`'s equivalent bootstrap failure: an
    // agent piping this output should not see a raw Node stack trace for an everyday "wrong
    // directory" mistake.
    return {
      ok: false,
      message: `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function optionLines(specs: readonly SkillsOptionSpec[] = SKILLS_OPTION_SPECS): string[] {
  const column = Math.max(...specs.map((spec) => spec.flags.length)) + 2;
  return specs.map((spec) => `  ${spec.flags.padEnd(column)}${spec.description}`);
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
    'Print a skill with `npx storybook skills <id>`, or every skill with `npx storybook skills --all`.',
    '`npx storybook skills <id> --help` shows one description.',
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
    ...optionLines(SKILLS_OPTION_SPECS.filter((spec) => spec.flags !== '--all')),
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
