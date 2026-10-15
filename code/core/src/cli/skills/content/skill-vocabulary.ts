import {
  getToolName,
  toCliPath,
  type ToolsetMethodId,
} from '../../../shared/open-service/toolset-names.ts';

// The transports a skill text is written for: commands to run, or MCP tools to call.
export type SkillTextTransport = 'cli' | 'mcp';

// The CLI prose names this command without its toolset, as agents type it after `stories`.
const CLI_SHORT_NAMES: Partial<Record<ToolsetMethodId, string>> = {
  'stories.findByComponent': 'find-by-component',
};

// The words that differ between the CLI and the MCP rendering of one skill text, so both
// transports state the same rules in one place.
export function skillVocabulary(transport: SkillTextTransport) {
  const ref = getToolName({ transport });
  const cli = transport === 'cli';
  return {
    cli,
    ref,
    // A tool in prose: `docs list` on the CLI, `docs-list` over MCP.
    name: (method: ToolsetMethodId) =>
      `\`${cli ? (CLI_SHORT_NAMES[method] ?? toCliPath(method)) : ref(method)}\``,
    // An input: `--stories` on the CLI, `stories` over MCP.
    flag: (input: string) => `\`${cli ? `--${input}` : input}\``,
    run: cli ? 'run' : 'call',
    Run: cli ? 'Run' : 'Call',
    output: cli ? 'output' : 'result',
    command: cli ? 'command' : 'tool',
    commands: cli ? 'commands' : 'tools',
  };
}

export type SkillVocabulary = ReturnType<typeof skillVocabulary>;
