import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderCodexSkill } from './codex-skill.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const claudeSkillsDir = resolve(packageRoot, 'skills');
const codexSkillsDir = resolve(packageRoot, '../codex-plugin/plugins/storybook/skills');

const codexSkills = readdirSync(claudeSkillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    renderCodexSkill(readFileSync(resolve(claudeSkillsDir, entry.name, 'SKILL.md'), 'utf8'))
  );

rmSync(codexSkillsDir, { recursive: true, force: true });

for (const { name, content } of codexSkills) {
  mkdirSync(resolve(codexSkillsDir, name), { recursive: true });
  writeFileSync(resolve(codexSkillsDir, name, 'SKILL.md'), content);
}
