import type { Options } from '../../types/index.ts';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { buildServerInstructions } from './content/build-server-instructions.ts';
import { buildStoryInstructions } from './content/build-story-instructions.ts';
import type { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { SKILLS, SKILL_IDS, isSkillId, type SkillId } from './content/skills.ts';
import type { SkillInputs, resolveSkillInputs } from './inputs.ts';
import type { getProjectInfo } from './project-info.ts';

export const SKILLS_OPTION_SPECS = [
  { flags: '--cwd <path>', description: 'Project directory of the target Storybook' },
  {
    flags: '-c, --config-dir <dir-name>',
    description: 'Storybook config directory of the target Storybook',
  },
  { flags: '--all', description: 'Print every skill in full' },
  { flags: '-h, --help', description: 'Show this usage and every skill' },
] as const;

export type SkillsRunInput = {
  tokens: string[];
  help?: boolean;
  all?: boolean;
  target: { cwd?: string; configDir?: string };
};

export type SkillsRunResult = {
  output: string;
  errorOutput?: string;
  exitCode: number;
  // For telemetry: which skill was served (or `all`), when the run got that far.
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
  | { kind: 'all' }
  | { kind: 'get'; id: SkillId }
  | { kind: 'error'; message: string };

export function resolveSkillsIntent({
  tokens,
  help,
  all,
}: Pick<SkillsRunInput, 'tokens' | 'help' | 'all'>): SkillsIntent {
  const [id, ...rest] = tokens;
  if (help) {
    return { kind: 'catalog' };
  }
  if (id === undefined) {
    return all ? { kind: 'all' } : { kind: 'catalog' };
  }
  if (!isSkillId(id)) {
    return {
      kind: 'error',
      message: `Unknown skill "${id}". Available skills: ${SKILL_IDS.join(', ')}.`,
    };
  }
  if (all) {
    return {
      kind: 'error',
      message: `\`--all\` prints every skill and takes no skill id; drop "${id}" or \`--all\`.`,
    };
  }
  if (rest.length > 0) {
    return {
      kind: 'error',
      message: `Unexpected arguments: ${rest.map((token) => `"${token}"`).join(' ')}. Run \`npx storybook skills --help\` for usage.`,
    };
  }
  return { kind: 'get', id };
}

export async function runSkillsCommand(
  input: SkillsRunInput,
  deps: SkillsRunDeps
): Promise<SkillsRunResult> {
  const intent = resolveSkillsIntent(input);
  if (intent.kind === 'catalog') {
    return { output: renderCatalogHelp(), exitCode: 0 };
  }
  if (intent.kind === 'error') {
    return { output: '', errorOutput: intent.message, exitCode: 1 };
  }
  try {
    const ids = intent.kind === 'all' ? SKILL_IDS : [intent.id];
    const docs = await serveSkills(ids, resolveStorybookConfigDir(input.target), deps);
    return {
      output: docs.join('\n\n---\n\n'),
      exitCode: 0,
      skill: intent.kind === 'all' ? 'all' : intent.id,
    };
  } catch (error) {
    if (error instanceof SkillsError) {
      return { output: '', errorOutput: error.message, exitCode: 1 };
    }
    throw error;
  }
}

// An expected failure: its message is printed to stderr with exit code 1, without a stack trace.
class SkillsError extends Error {}

async function serveSkills(
  ids: readonly SkillId[],
  configDir: string,
  deps: SkillsRunDeps
): Promise<string[]> {
  let inputs: SkillInputs | undefined;
  const docs: string[] = [];
  for (const id of ids) {
    if (id === 'setup') {
      docs.push(await serveSetup(configDir, deps));
    } else {
      inputs ??= await loadInputs(configDir, deps);
      docs.push(assemble(id, inputs));
    }
  }
  return docs;
}

async function serveSetup(configDir: string, deps: SkillsRunDeps): Promise<string> {
  const probed = await deps.getProjectInfo({ configDir });
  if (!probed.ok) {
    throw new SkillsError(probed.message);
  }
  return (await deps.getSetupMarkdown(probed.projectInfo)).markdown;
}

async function loadInputs(configDir: string, deps: SkillsRunDeps): Promise<SkillInputs> {
  try {
    return await deps.resolveSkillInputs(await deps.loadStorybook({ configDir }));
  } catch (error) {
    // Reduce to one clean line, matching `cli/tools/run.ts`'s equivalent bootstrap failure: an
    // agent piping this output should not see a raw Node stack trace for an everyday "wrong
    // directory" mistake.
    throw new SkillsError(
      `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function table(rows: [string, string][]): string[] {
  const column = Math.max(...rows.map(([key]) => key.length)) + 2;
  return rows.map(([key, text]) => `  ${key.padEnd(column)}${text}`);
}

function renderCatalogHelp(): string {
  return [
    'Usage: npx storybook skills [options] [id]',
    '',
    'Agent skills served by this Storybook.',
    '',
    'Options:',
    ...table(SKILLS_OPTION_SPECS.map((spec) => [spec.flags, spec.description])),
    '',
    'Skills:',
    ...table(SKILL_IDS.map((id) => [id, SKILLS[id].blurb])),
    '',
    'Print a skill with `npx storybook skills <id>`, or every skill with `npx storybook skills --all`.',
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
