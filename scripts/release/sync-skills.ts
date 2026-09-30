import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { x } from 'tinyexec';

import { esMain } from '../utils/esmain.ts';

const STORYBOOK_DIR = join(import.meta.dirname, '..', '..');
const SKILLS_PATH = 'code/lib/claude-plugin/skills';

async function run(command: string, args: string[], cwd: string) {
  const { exitCode, stdout, stderr } = await x(command, args, { nodeOptions: { cwd } });
  if (exitCode !== 0) {
    throw new Error(`${command} ${args[0]} failed:\n${stderr}`);
  }
  return stdout.trim();
}

const git = (args: string[], cwd: string) => run('git', args, cwd);

/**
 * Copies code/lib/claude-plugin/skills, as committed at `ref`, into the skills repository and tags
 * it v<version>. Prereleases go to `next`, releases to `main`.
 */
export async function syncSkills({
  version,
  repoUrl,
  ref = 'HEAD',
}: {
  version: string;
  repoUrl: string;
  ref?: string;
}) {
  const tag = `v${version}`;
  const branch = version.includes('-') ? 'next' : 'main';
  const cloneDir = await mkdtemp(join(tmpdir(), 'skills-'));

  try {
    await git(
      ['clone', '--quiet', '--depth', '1', '--no-tags', '--branch', branch, repoUrl, cloneDir],
      STORYBOOK_DIR
    );

    for (const [key, value] of [
      ['user.name', 'storybook-bot'],
      ['user.email', '32066757+storybook-bot@users.noreply.github.com'],
      ['commit.gpgSign', 'false'],
      ['tag.gpgSign', 'false'],
    ]) {
      await git(['config', key, value], cloneDir);
    }

    const skillsDir = join(cloneDir, 'skills');
    const archive = join(cloneDir, '.git', 'skills.tar');
    await rm(skillsDir, { recursive: true, force: true });
    await git(
      ['archive', '--prefix=skills/', `--output=${archive}`, `${ref}:${SKILLS_PATH}`],
      STORYBOOK_DIR
    );
    await run('tar', ['-xf', archive, '-C', cloneDir], cloneDir);

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const hasSkills = entries.some(
      (entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, 'SKILL.md'))
    );
    if (!hasSkills) {
      throw new Error(`No skills found at ${ref}`);
    }

    await git(['add', '--all', 'skills'], cloneDir);
    const { exitCode } = await x('git', ['diff', '--cached', '--quiet'], {
      nodeOptions: { cwd: cloneDir },
    });
    if (exitCode === 0) {
      console.log(`skills/ on ${branch} already matches`);
    } else {
      await git(['commit', '--quiet', '-m', `Sync skills from storybook ${tag}`], cloneDir);
    }

    await git(['tag', tag], cloneDir);
    await git(['push', '--quiet', '--atomic', 'origin', branch, tag], cloneDir);
    console.log(
      `${branch} is at ${await git(['rev-parse', '--short', 'HEAD'], cloneDir)}, tagged ${tag}`
    );
  } finally {
    await rm(cloneDir, { recursive: true, force: true });
  }
}

if (esMain(import.meta.url)) {
  const { VERSION, SKILLS_REPO_URL, STORYBOOK_REF } = process.env;
  if (!VERSION || !SKILLS_REPO_URL) {
    console.error(
      'Set VERSION (e.g. 11.0.0-alpha.3) and SKILLS_REPO_URL (e.g. https://github.com/storybookjs/skills.git)'
    );
    process.exit(1);
  }
  syncSkills({ version: VERSION, repoUrl: SKILLS_REPO_URL, ref: STORYBOOK_REF || undefined }).catch(
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
