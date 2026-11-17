import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import {
  STORYBOOK_AGENT_INSTRUCTIONS,
  addStorybookAgentInstructions,
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

  it('wraps the section in markers, with the heading and both skills', () => {
    expect(STORYBOOK_AGENT_INSTRUCTIONS).toMatch(
      /^<!-- BEGIN:storybook-skills -->\n[\s\S]*## Storybook skills\n[\s\S]*`ui-workflow`[\s\S]*`component-docs`[\s\S]*<!-- END:storybook-skills -->\n$/
    );
  });

  it('appends the section to an existing AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n\nUse pnpm.\n\n');

    await addStorybookAgentInstructions(ROOT);

    expect(read('AGENTS.md')).toBe(`# Rules\n\nUse pnpm.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it.each([
    '## Storybook\n\n- `ui-workflow`: for UI changes. Follow it to update your stories and run the tests.\n',
    'Run /component-docs for questions about a component.\n',
  ])('leaves a file alone that already names a Storybook skill (%j)', async (custom) => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), custom);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([]);
    expect(read('AGENTS.md')).toBe(custom);
  });

  const OUTDATED = `# Rules\n\n<!-- BEGIN:storybook-skills -->\n## Storybook\n\n- \`ui-workflow\`: for UI changes.\n<!-- END:storybook-skills -->\n\nUse pnpm.\n`;

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
    const custom = '## Storybook\n\n- `ui-workflow`: for UI changes, without the review.\n';
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
