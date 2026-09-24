import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

import { renderCodexSkill } from './scripts/codex-skill.ts';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, '../../..');
const codexSkillsPath = 'code/lib/codex-plugin/plugins/storybook/skills';

const claudeSkills = readdirSync(resolve(packageRoot, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(({ name }) => ({
    name,
    content: readFileSync(resolve(packageRoot, 'skills', name, 'SKILL.md'), 'utf8'),
  }));

type ClaudeMarketplaceJson = {
  plugins?: Array<{
    source?: string;
  }>;
};

async function isClaudeCliAvailable() {
  try {
    const result = await x('claude', ['--version'], { nodeOptions: { cwd: packageRoot } });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

const hasClaudeCli = await isClaudeCliAvailable();

function git(args: string[]) {
  return x('git', args, { nodeOptions: { cwd: repoRoot } });
}

function readMarketplace(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as ClaudeMarketplaceJson;
}

function normalizeMarketplace(marketplace: ClaudeMarketplaceJson) {
  return {
    ...marketplace,
    plugins: marketplace.plugins?.map((plugin) => ({
      ...plugin,
      source: '<plugin-root>',
    })),
  };
}

// Claude Code silently drops a skill's description from the agent-visible
// skill listing when it exceeds a shared listing budget — the skill then shows
// as a bare name with no trigger text and agents stop invoking it (this broke
// the 806-browse-request eval on 2026-07-02). The budget shrinks as more
// skills/plugins are installed; ~384 UTF-8 bytes was the empirical cutoff in a
// minimal sandbox, so stay well below it to survive plugin-heavy environments.
const MAX_SKILL_DESCRIPTION_BYTES = 350;

const HARNESS_TOOLS = [
  'preview_start',
  '.claude/launch.json',
  'control-in-app-browser',
  'require_escalated',
  'Claude_Browser',
  'preview_open',
  'browser_navigate',
  'preview_eval',
];

const RENDER_HINT = 'Run `yarn nx compile claude-plugin` and commit the Codex skills.';

function readSkillDescription(skill: string) {
  const description = skill.match(/^description: (.*)$/m)?.[1];
  if (description === undefined) {
    throw new Error('No description frontmatter found in skill');
  }
  return description;
}

describe('canonical skills', () => {
  it.each(claudeSkills)(
    '$name keeps its description under the silent-drop listing budget',
    ({ content }) => {
      const description = readSkillDescription(content);
      expect(Buffer.byteLength(description, 'utf8')).toBeLessThanOrEqual(
        MAX_SKILL_DESCRIPTION_BYTES
      );
    }
  );

  it.each(claudeSkills)('$name names no harness-specific tool or file', ({ content }) => {
    for (const harnessTool of HARNESS_TOOLS) {
      expect(content).not.toContain(harnessTool);
    }
  });
});

describe('stories skill prerequisites', () => {
  it('uses Storybook documentation and treats setup as upgrade approval', () => {
    const skill = readFileSync(resolve(packageRoot, 'skills/stories/SKILL.md'), 'utf8');

    expect(skill).toContain('docs list');
    expect(skill).toContain('docs show');
    expect(skill.indexOf('docs list')).toBeLessThan(skill.indexOf('docs show'));
    expect(skill).toContain('set up or install Storybook');
  });
});

// Compared against HEAD rather than the working tree: CI runs `compile` before
// `yarn test`, so a working-tree comparison would pass even when the render
// was never committed.
describe('committed Codex skills', () => {
  it.each(claudeSkills)('$name equals the render of the canonical skill', async ({ content }) => {
    const rendered = renderCodexSkill(content);
    const committed = await git(['show', `HEAD:${codexSkillsPath}/${rendered.name}/SKILL.md`]);

    expect(committed.exitCode, RENDER_HINT).toBe(0);
    expect(committed.stdout, RENDER_HINT).toBe(rendered.content);
  });

  it('hold exactly the rendered set of skills', async () => {
    const rendered = claudeSkills.map(({ content }) => renderCodexSkill(content).name).sort();
    const committed = await git(['ls-tree', '--name-only', `HEAD:${codexSkillsPath}`]);

    expect(committed.stdout.trim().split('\n').sort(), RENDER_HINT).toEqual(rendered);
  });
});

describe('Storybook Claude plugin CLI validation', () => {
  it('keeps root and package-local marketplaces in sync', () => {
    const packageMarketplace = readMarketplace(
      resolve(packageRoot, '.claude-plugin/marketplace.json')
    );
    const rootMarketplace = readMarketplace(resolve(repoRoot, '.claude-plugin/marketplace.json'));

    expect(packageMarketplace.plugins?.[0]?.source).toBe('./');
    expect(rootMarketplace.plugins?.[0]?.source).toBe('./code/lib/claude-plugin');
    expect(normalizeMarketplace(rootMarketplace)).toEqual(normalizeMarketplace(packageMarketplace));
  });

  it.skipIf(!hasClaudeCli)(
    'passes claude plugin validate for marketplace and plugin manifests',
    async () => {
      const packageMarketplace = await x('claude', ['plugin', 'validate', '.'], {
        nodeOptions: { cwd: packageRoot },
      });
      const rootMarketplace = await x('claude', ['plugin', 'validate', '.'], {
        nodeOptions: { cwd: repoRoot },
      });
      const plugin = await x('claude', ['plugin', 'validate', '.claude-plugin/plugin.json'], {
        nodeOptions: { cwd: packageRoot },
      });

      expect(packageMarketplace.exitCode).toBe(0);
      expect(rootMarketplace.exitCode).toBe(0);
      expect(plugin.exitCode).toBe(0);
    }
  );
});
