// Runs in the eval sandbox after the Codex CLI is installed, as `node -e <this file> <model slug>
// <Luna's test rule> <pattern of Sol's test rules>`. Reads the catalog bundled with that CLI and
// prints the path of the instructions it writes: the model's own, with Sol's test rules.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [slug, lunaRule, solRulesPattern] = process.argv.slice(1);
const codex = (args) =>
  execFileSync('codex', args, { cwd: os.tmpdir(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const catalog = JSON.parse(codex(['debug', 'models', '--bundled']));
const instructions = (model) =>
  catalog.models.find((entry) => entry.slug === model)?.base_instructions ?? '';
const fail = (problem) => {
  throw new Error(
    problem + ' in the catalog of ' + codex(['--version']).trim() + '. Update LUNA_TEST_RULE or SOL_TEST_RULES in agent-eval/lib/templates.ts.'
  );
};

const own = instructions(slug);
if (!own.includes(lunaRule)) {
  fail('The base instructions of ' + slug + ' do not have the line ' + JSON.stringify(lunaRule));
}
const solRules = instructions('gpt-6.1-sol')
  .split('\n')
  .map((line) => line.trimEnd())
  .filter((line) => new RegExp(solRulesPattern).test(line));
if (solRules.length !== 2) {
  fail('The base instructions of gpt-6.1-sol have ' + solRules.length + ' test rules instead of 2');
}

const file = path.join(os.homedir(), '.codex', 'storybook-eval-instructions.md');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, own.replace(lunaRule, solRules.join('\n')));
process.stdout.write(file);
