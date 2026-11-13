import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import {
  STORYBOOK_AGENT_INSTRUCTIONS,
  addStorybookAgentInstructions,
  planStorybookAgentInstructions,
  storybookAgentInstructions,
} from './agentInstructions.ts';

vi.mock('node:fs/promises', { spy: true });

const ROOT = '/test/project';
const read = (file: string) => vol.readFileSync(join(ROOT, file), 'utf8');

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(memfs.fs.promises.readFile as unknown as typeof readFile);
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof writeFile
  );
  vol.reset();
  vol.mkdirSync(join(ROOT, '.claude'), { recursive: true });
});

describe('addStorybookAgentInstructions', () => {
  it('writes nothing when an existing file cannot be read', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n');
    vi.mocked(readFile).mockRejectedValueOnce(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    );

    await expect(addStorybookAgentInstructions(ROOT)).rejects.toThrow('EACCES');
    expect(read('AGENTS.md')).toBe('# Rules\n');
  });

  it('creates AGENTS.md when the project has none', async () => {
    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
    ]);
    expect(read('AGENTS.md')).toBe(STORYBOOK_AGENT_INSTRUCTIONS);
  });

  it('wraps the section in markers, with the heading, the two skills and the test command', () => {
    expect(STORYBOOK_AGENT_INSTRUCTIONS).toMatch(
      /^<!-- BEGIN:storybook-skills -->\n[\s\S]*## Storybook\n[\s\S]*1\. `component-docs`[\s\S]*2\. `write-stories`[\s\S]*3\. Run the story tests[\s\S]*`npx storybook tools test run --changed`[\s\S]*<!-- END:storybook-skills -->\n$/
    );
    expect(STORYBOOK_AGENT_INSTRUCTIONS).not.toContain('ui-review');
  });

  // Plugin users copy the section from these files by hand.
  it.each(['code/lib/claude-plugin/README.md', 'code/lib/codex-plugin/README.md', 'MIGRATION.md'])(
    '%s prints the current section',
    async (file) => {
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
      const repoRoot = join(import.meta.dirname, '../../../..');
      expect(fs.readFileSync(join(repoRoot, file), 'utf8')).toContain(STORYBOOK_AGENT_INSTRUCTIONS);
    }
  );

  it('writes the section without the test step for a project without addon-vitest', async () => {
    await addStorybookAgentInstructions(ROOT, 'install', { testSupported: false });

    expect(read('AGENTS.md')).toBe(storybookAgentInstructions({ testSupported: false }));
    expect(read('AGENTS.md')).not.toContain('test run');
  });

  it('keeps the test step of another Storybook when one without addon-vitest installs', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), STORYBOOK_AGENT_INSTRUCTIONS);

    expect(await addStorybookAgentInstructions(ROOT, 'install', { testSupported: false })).toEqual(
      []
    );
    expect(await addStorybookAgentInstructions(ROOT, 'update', { testSupported: false })).toEqual([
      { file: 'AGENTS.md', change: 'updated' },
    ]);
    expect(read('AGENTS.md')).toBe(storybookAgentInstructions({ testSupported: false }));
  });

  // The section that 11.0.0-beta.2 wrote, word for word.
  const BETA_2 = `<!-- BEGIN:storybook-skills -->
<!-- Storybook updates this section on upgrade. Remove both markers to keep your own edits. -->

## Storybook

For every change to how the UI looks (you create, change, or delete a component, story, style, theme, or design token), follow these steps in order. Each step has a Storybook skill. First invoke the skills of all the steps, before you edit any file. Then follow each skill at its step.

1. \`component-docs\`: look up the components to reuse, with their props and usage examples, before you edit any file. Also when the user asks about a component's props, API, or usage.
2. \`write-stories\`: every component you create or change gets stories.
3. \`test-stories\`: run the story tests after every change, the way this skill says, never with a \`package.json\` test script, and fix what fails. Also when the user asks to run or fix story tests.
4. \`ui-review\`: publish a review that shows the user what changed, as your last step. Also when the user asks to see components or stories.

<!-- END:storybook-skills -->
`;

  it('replaces the section of 11.0.0-beta.2 on upgrade, and keeps the rest of the file', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), `# Rules\n\n${BETA_2}\nUse pnpm.\n`);
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), `@AGENTS.md\n`);

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([
      { file: 'AGENTS.md', change: 'updated' },
    ]);
    expect(read('AGENTS.md')).toBe(`# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}\nUse pnpm.\n`);
    expect(read('CLAUDE.md')).toBe('@AGENTS.md\n');
  });

  it('keeps the section of 11.0.0-beta.2 when the user removed its markers', async () => {
    const unmarked = BETA_2.split('\n')
      .filter((line) => !line.startsWith('<!-- '))
      .join('\n');
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), unmarked);

    for (const mode of ['update', 'install'] as const) {
      expect(await addStorybookAgentInstructions(ROOT, mode)).toEqual([]);
      expect(read('AGENTS.md')).toBe(unmarked);
    }
  });

  it('appends the section to an existing AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n\nUse pnpm.\n\n');

    await addStorybookAgentInstructions(ROOT);

    expect(read('AGENTS.md')).toBe(`# Rules\n\nUse pnpm.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it.each([
    '## Storybook\n\n1. `write-stories`: every component gets stories.\n2. `test-stories`: run the story tests.\n',
    'Run /component-docs for questions about a component.\n',
  ])('leaves a file alone that already names a Storybook skill (%j)', async (custom) => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), custom);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([]);
    expect(read('AGENTS.md')).toBe(custom);
  });

  const OUTDATED = `# Rules\n\n<!-- BEGIN:storybook-skills -->\n## Storybook\n\n- \`component-docs\`: to reuse components.\n<!-- END:storybook-skills -->\n\nUse pnpm.\n`;

  it.each(['install', 'update'] as const)(
    'replaces an outdated section between the markers and keeps the rest (%s)',
    async (mode) => {
      vol.writeFileSync(join(ROOT, 'AGENTS.md'), OUTDATED);

      expect(await addStorybookAgentInstructions(ROOT, mode)).toEqual([
        { file: 'AGENTS.md', change: 'updated' },
      ]);
      expect(read('AGENTS.md')).toBe(`# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}\nUse pnpm.\n`);
    }
  );

  it('writes nothing when the section between the markers is current', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), `# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
    vi.mocked(writeFile).mockClear();

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('adds nothing on an update, so a removed or edited section stays that way', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n');
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([]);
    expect(read('AGENTS.md')).toBe('# Rules\n');
    expect(read('CLAUDE.md')).toBe('Be brief.\n');
  });

  it('leaves a section without markers alone on an update', async () => {
    const custom = '## Storybook\n\n1. `write-stories`: every component gets stories.\n';
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), custom);

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([]);
    expect(read('AGENTS.md')).toBe(custom);
  });

  it('keeps the line endings of a CRLF file, and leaves a current section alone', async () => {
    const crlf = (text: string) => text.replaceAll('\n', '\r\n');
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), crlf(OUTDATED));

    await addStorybookAgentInstructions(ROOT, 'update');
    expect(read('AGENTS.md')).toBe(crlf(`# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}\nUse pnpm.\n`));

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([]);
    expect(read('AGENTS.md')).not.toContain('\n\n');
  });

  it('appends the section with the line endings of the file', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\r\n');

    await addStorybookAgentInstructions(ROOT);

    expect(read('AGENTS.md')).toBe(
      `# Rules\r\n\r\n${STORYBOOK_AGENT_INSTRUCTIONS.replaceAll('\n', '\r\n')}`
    );
  });

  it('ignores a marker mentioned in prose, and stops a block at the next BEGIN marker', async () => {
    const prose = 'Keep the text between `<!-- BEGIN:storybook-skills -->` and the end marker.\n';
    const broken = `<!-- BEGIN:storybook-skills -->\nlost its end\n`;
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), `${prose}\n${broken}\n${OUTDATED}`);

    await addStorybookAgentInstructions(ROOT, 'update');

    expect(read('AGENTS.md')).toBe(
      `${prose}\n${broken}\n# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}\nUse pnpm.\n`
    );
  });

  it('keeps a block whose body imports AGENTS.md instead of a copy', async () => {
    const imported = '<!-- BEGIN:storybook-skills -->\n@AGENTS.md\n<!-- END:storybook-skills -->\n';
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), OUTDATED);
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), imported);

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([
      { file: 'AGENTS.md', change: 'updated' },
    ]);
    expect(read('CLAUDE.md')).toBe(imported);
  });

  it('adds no copy to CLAUDE.md when another CLAUDE.md has the block between markers', async () => {
    const block = `<!-- BEGIN:storybook-skills -->\n## Storybook\n\nUse the skills.\n<!-- END:storybook-skills -->\n`;
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), block);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: '.claude/CLAUDE.md', change: 'updated' },
    ]);
    expect(read('CLAUDE.md')).toBe('Be brief.\n');
  });

  it('updates the copy in CLAUDE.md too, and adds no second copy', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), OUTDATED);
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), OUTDATED);

    expect(await addStorybookAgentInstructions(ROOT, 'update')).toEqual([
      { file: 'AGENTS.md', change: 'updated' },
      { file: '.claude/CLAUDE.md', change: 'updated' },
    ]);
    expect(read('.claude/CLAUDE.md')).toBe(
      `# Rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}\nUse pnpm.\n`
    );
    expect(read('CLAUDE.md')).toBe('Be brief.\n');
  });

  it('also adds the section to CLAUDE.md, which Claude Code reads instead of AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: 'CLAUDE.md', change: 'added' },
    ]);
    expect(read('CLAUDE.md')).toBe(`Be brief.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it('adds nothing on a second run, also not to CLAUDE.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    await addStorybookAgentInstructions(ROOT);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([]);
    expect(read('CLAUDE.md')).toBe(`Be brief.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it('adds one copy for Claude Code when the project has both CLAUDE.md files', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), 'Be kind.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: 'CLAUDE.md', change: 'added' },
    ]);
    expect(read('.claude/CLAUDE.md')).toBe('Be kind.\n');
  });

  it('adds the section to .claude/CLAUDE.md when it is the only CLAUDE.md', async () => {
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), 'Be kind.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: '.claude/CLAUDE.md', change: 'added' },
    ]);
  });

  it('adds the section to CLAUDE.local.md when it is the only file Claude Code reads', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.local.md'), 'Use my fork.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: 'CLAUDE.local.md', change: 'added' },
    ]);
  });

  it('prefers the shared CLAUDE.md over the personal CLAUDE.local.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.local.md'), 'Use my fork.\n');
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: 'CLAUDE.md', change: 'added' },
    ]);
    expect(read('CLAUDE.local.md')).toBe('Use my fork.\n');
  });

  it.each([
    ['CLAUDE.md', '@AGENTS.md\n'],
    ['CLAUDE.md', 'Read these first: @./AGENTS.md\n'],
    ['.claude/CLAUDE.md', '@../AGENTS.md\n'],
    ['CLAUDE.local.md', '@AGENTS.md\n'],
  ])('writes no CLAUDE.md when %s imports AGENTS.md (%j)', async (file, content) => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, file), content);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
    ]);
  });

  it('does not count an import of .claude/AGENTS.md as an import of the root AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), '@AGENTS.md\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      { file: 'AGENTS.md', change: 'added' },
      { file: '.claude/CLAUDE.md', change: 'added' },
    ]);
  });

  it('creates no CLAUDE.md', async () => {
    await addStorybookAgentInstructions(ROOT);

    expect(vol.existsSync(join(ROOT, 'CLAUDE.md'))).toBe(false);
  });
});

describe('planStorybookAgentInstructions', () => {
  it('writes another section, such as the MCP server instructions, in place of the skills section', async () => {
    const section = '## Storybook\n\nRun `npx storybook skills ui-review --mcp`.\n';
    const files = await planStorybookAgentInstructions(
      async (file) => (file === 'CLAUDE.md' ? '# Rules\n' : undefined),
      'install',
      section
    );

    expect(files).toEqual({ 'AGENTS.md': section, 'CLAUDE.md': `# Rules\n\n${section}` });
  });
});
