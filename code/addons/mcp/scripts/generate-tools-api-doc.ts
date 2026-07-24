/**
 * Generates a markdown reference of everything an agent sees from the Storybook
 * AI surface: MCP server instructions and tool definitions (with review off and
 * on), the plugin skills, and the `storybook ai` CLI help output.
 *
 * Run from the repo root (bunfig.toml there maps .md/.html imports to text):
 *
 *   bun packages/addon-mcp/scripts/generate-tools-api-doc.ts [output-path]
 *
 * Defaults to writing <repo-root>/tools-api.md (gitignored).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { buildServerInstructions } from '../src/instructions/build-server-instructions.ts';
import { getAddonToolMetadata, type ToolMetadata } from '../src/tools/tool-registry.ts';
import type { ToolAvailability } from '../src/utils/get-tool-availability.ts';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputPath = path.resolve(repoRoot, process.argv[2] ?? 'tools-api.md');
const internalStorybookDir = path.join(repoRoot, 'apps/internal-storybook');

const adapter = new ValibotJsonSchemaAdapter();

// Everything enabled except review, which is the variable under comparison.
const availability = (reviewEnabled: boolean): ToolAvailability => ({
  moduleGraphSupported: true,
  changeDetectionEnabled: true,
  reviewEnabled,
  reviewEnabledForCli: reviewEnabled,
  docsEnabled: true,
  docsHasManifests: true,
  docsFeatureEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  docgenServer: false,
});

const instructions = (reviewEnabled: boolean) =>
  buildServerInstructions({
    devEnabled: true,
    testEnabled: true,
    docsEnabled: true,
    changeDetectionEnabled: true,
    moduleGraphSupported: true,
    reviewEnabled,
  });

async function toJsonSchema(schema: unknown): Promise<Record<string, unknown>> {
  return (await adapter.toJsonSchema(
    schema as Parameters<ValibotJsonSchemaAdapter['toJsonSchema']>[0]
  )) as Record<string, unknown>;
}

function fence(content: string, language = ''): string {
  return `\`\`\`\`${language}\n${content.trim()}\n\`\`\`\``;
}

const MAX_WIDTH = 80;

/**
 * Greedy word-wrap of a single line. Continuation lines keep the original
 * indentation, plus the width of a list marker (`- `, `1. `, `> `) so wrapped
 * list items stay aligned. With `columns: true`, a `name  description` layout
 * (two or more interior spaces) wraps the description aligned to its column —
 * used for CLI help tables.
 */
function wrapLine(line: string, width = MAX_WIDTH, { columns = false } = {}): string[] {
  if (line.length <= width) return [line];
  let lead = '';
  const columnMatch = columns ? /^(\s*\S+\s{2,})/.exec(line) : null;
  if (columnMatch && columnMatch[1]!.length < width / 2) {
    lead = columnMatch[1]!;
  } else {
    const markerMatch = /^(\s*)([-*] |\d+\. |> )?/.exec(line)!;
    lead = `${markerMatch[1] ?? ''}${markerMatch[2] ?? ''}`;
  }
  const continuation = ' '.repeat(lead.length);
  const words = line.slice(lead.length).split(' ');
  const wrapped: string[] = [];
  let current = lead;
  let hasWord = false;
  for (const word of words) {
    if (hasWord && current.length + 1 + word.length > width) {
      wrapped.push(current);
      current = continuation + word;
    } else {
      current = hasWord ? `${current} ${word}` : current + word;
    }
    hasWord = true;
  }
  wrapped.push(current);
  return wrapped;
}

/**
 * Wraps the finished document at MAX_WIDTH. Headings are left alone; `ts`
 * fences are pre-wrapped by commentFor; everything else (prose, `md` fences,
 * plain CLI fences) is word-wrapped, with column-aware continuation inside
 * plain fences so CLI help tables stay readable.
 */
function wrapMarkdown(document: string): string {
  const out: string[] = [];
  let fenceLanguage: string | null = null;
  for (const line of document.split('\n')) {
    if (line.startsWith('````')) {
      fenceLanguage = fenceLanguage === null ? line.slice(4) : null;
      out.push(line);
      continue;
    }
    if (fenceLanguage === 'ts' || line.startsWith('#')) {
      out.push(line);
      continue;
    }
    out.push(...wrapLine(line, MAX_WIDTH, { columns: fenceLanguage === '' }));
  }
  return out.join('\n');
}

// oxlint-disable-next-line no-explicit-any -- JSON Schema is inherently untyped here
type JsonSchema = Record<string, any>;

function commentFor(schema: JsonSchema, indent: string): string {
  const raw: string[] = schema.description ? schema.description.split('\n') : [];
  if (schema.default !== undefined) raw.push(`@default ${JSON.stringify(schema.default)}`);
  if (schema.minItems !== undefined) raw.push(`@minItems ${schema.minItems}`);
  if (schema.minimum !== undefined) raw.push(`@minimum ${schema.minimum}`);
  if (raw.length === 0) return '';
  const lines = raw.flatMap((line) => wrapLine(line, MAX_WIDTH - indent.length - 3));
  if (lines.length === 1 && indent.length + 7 + lines[0]!.length <= MAX_WIDTH) {
    return `${indent}/** ${lines[0]} */\n`;
  }
  return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`.trimEnd()).join('\n')}\n${indent} */\n`;
}

/**
 * Renders the tmcp-produced JSON Schemas as TypeScript types. Only handles the
 * constructs the Valibot adapter emits (objects, arrays, anyOf unions, enums,
 * primitives) — anything else falls back to `unknown`.
 */
function schemaToTs(schema: JsonSchema | undefined, indent = ''): string {
  if (!schema) return 'unknown';
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((variant: JsonSchema) => schemaToTs(variant, indent)).join(' | ');
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value: unknown) => JSON.stringify(value)).join(' | ');
  }
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const item = schemaToTs(schema.items, indent);
      if (/^[A-Za-z]+$/.test(item)) return `${item}[]`;
      return `Array<${item}>`;
    }
    case 'object': {
      const properties: Record<string, JsonSchema> = schema.properties ?? {};
      const keys = Object.keys(properties);
      if (keys.length === 0) {
        return schema.additionalProperties !== undefined ? 'Record<string, unknown>' : '{}';
      }
      const required = new Set<string>(schema.required ?? []);
      // Two-space indentation so character counts match the 80-column budget.
      const inner = `${indent}  `;
      const fields = keys.map((key) => {
        const property = properties[key]!;
        const optional = required.has(key) ? '' : '?';
        return `${commentFor(property, inner)}${inner}${key}${optional}: ${schemaToTs(property, inner)};`;
      });
      return `{\n${fields.join('\n')}\n${indent}}`;
    }
    default:
      return 'unknown';
  }
}

function tsBlock(name: 'Input' | 'Output', schema: JsonSchema): string {
  return fence(`type ${name} = ${schemaToTs(schema)}`, 'ts');
}

function hasShape(schema: JsonSchema): boolean {
  return schema.type !== 'object' || Object.keys(schema.properties ?? {}).length > 0;
}

async function renderTool(tool: ToolMetadata): Promise<string> {
  const lines = [`### \`${tool.name}\``, ''];
  if (tool.title) {
    lines.push(`**Title:** ${tool.title}`, '');
  }
  if (tool._meta) {
    lines.push(`**\`_meta\`:** \`${JSON.stringify(tool._meta)}\``, '');
  }
  lines.push('**Description**', '', fence(tool.description ?? '(none)', 'md'), '');
  const inputSchema = tool.schema ? await toJsonSchema(tool.schema) : undefined;
  lines.push('**Input**', '');
  lines.push(inputSchema && hasShape(inputSchema) ? tsBlock('Input', inputSchema) : '_None._', '');
  lines.push('**Output**', '');
  lines.push(
    tool.outputSchema
      ? tsBlock('Output', await toJsonSchema(tool.outputSchema))
      : '_None — the tool returns unstructured text content._',
    ''
  );
  return lines.join('\n');
}

async function renderServerSection(title: string, reviewEnabled: boolean): Promise<string> {
  const tools = getAddonToolMetadata({ availability: availability(reviewEnabled) });
  const toolSections = await Promise.all(tools.map(renderTool));
  return [
    `## ${title}`,
    '',
    '### Server instructions',
    '',
    fence(instructions(reviewEnabled), 'md'),
    '',
    `### Tools (${tools.length})`,
    '',
    tools.map((tool) => `- \`${tool.name}\``).join('\n'),
    '',
    toolSections.join('\n'),
  ].join('\n');
}

function diffSummary(): string {
  const off = new Map(
    getAddonToolMetadata({ availability: availability(false) }).map((t) => [t.name, t])
  );
  const on = new Map(
    getAddonToolMetadata({ availability: availability(true) }).map((t) => [t.name, t])
  );
  const added = [...on.keys()].filter((name) => !off.has(name));
  const removed = [...off.keys()].filter((name) => !on.has(name));
  const changed = [...on.keys()].filter(
    (name) => off.has(name) && off.get(name)!.description !== on.get(name)!.description
  );
  const lines = ['## Review off vs on — summary', ''];
  lines.push(
    `- Tools added with review on: ${added.map((n) => `\`${n}\``).join(', ') || '(none)'}`
  );
  lines.push(
    `- Tools removed with review on: ${removed.map((n) => `\`${n}\``).join(', ') || '(none)'}`
  );
  lines.push(
    `- Tools with a different description: ${changed.map((n) => `\`${n}\``).join(', ') || '(none)'}`
  );
  lines.push('- The server instructions differ between the two modes (see the sections below).');
  return lines.join('\n') + '\n';
}

async function renderSkills(): Promise<string> {
  const plugins = [
    {
      title: 'Claude Code plugin (`packages/claude-plugin`)',
      dir: 'packages/claude-plugin/skills',
    },
    {
      title: 'Codex plugin (`packages/codex-plugin`)',
      dir: 'packages/codex-plugin/plugins/storybook/skills',
    },
  ];
  const sections = ['## Skills', ''];
  for (const plugin of plugins) {
    sections.push(`### ${plugin.title}`, '');
    const skillsDir = path.join(repoRoot, plugin.dir);
    const skillNames = (await fs.readdir(skillsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const skillName of skillNames) {
      const content = await fs.readFile(path.join(skillsDir, skillName, 'SKILL.md'), 'utf8');
      sections.push(`#### \`${skillName}\``, '', fence(content, 'md'), '');
    }
  }
  return sections.join('\n');
}

function stripAnsi(text: string): string {
  // oxlint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, '');
}

async function runCliHelp(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('npx', ['storybook', 'ai', ...args, '--help'], {
      cwd: internalStorybookDir,
      env: { ...process.env, STORYBOOK_FEATURE_AI_CLI: '1' },
      maxBuffer: 10 * 1024 * 1024,
    });
    return stripAnsi([stdout, stderr].filter(Boolean).join('\n'));
  } catch (error) {
    return `(command failed)\n${stripAnsi(String(error))}`;
  }
}

async function renderCliSection(): Promise<string> {
  const toolNames = getAddonToolMetadata({ availability: availability(true) }).map((t) => t.name);
  const commands = ['setup', ...toolNames];
  const [topLevel, ...commandHelps] = await Promise.all([
    runCliHelp([]),
    ...commands.map((command) => runCliHelp([command])),
  ]);
  const sections = [
    '## `storybook ai` CLI (`STORYBOOK_FEATURE_AI_CLI=1`)',
    '',
    'Captured against `apps/internal-storybook` (review enabled in its `.storybook` config). The top-level help embeds the same server instructions the MCP server serves.',
    '',
    '### `npx storybook ai --help`',
    '',
    fence(topLevel),
    '',
  ];
  commands.forEach((command, index) => {
    sections.push(
      `### \`npx storybook ai ${command} --help\``,
      '',
      fence(commandHelps[index]!),
      ''
    );
  });
  return sections.join('\n');
}

const generatedAt = new Date().toISOString().slice(0, 10);
const document = [
  '# Storybook MCP / AI tools API',
  '',
  `> Generated ${generatedAt} by \`packages/addon-mcp/scripts/generate-tools-api-doc.ts\` — do not edit by hand.`,
  '> Regenerate from the repo root with `bun packages/addon-mcp/scripts/generate-tools-api-doc.ts`.',
  '',
  'Assumed configuration: all toolsets enabled (`dev`, `test`, `docs`), component manifests available, `@storybook/addon-vitest` installed, `@storybook/addon-a11y` enabled, change detection on, module graph supported, single source. The only variable is the `experimentalReview` feature flag.',
  '',
  'Tool inputs and outputs are rendered as TypeScript types derived from the JSON Schemas the server actually serves; field docs, defaults, and constraints are preserved as doc comments.',
  '',
  diffSummary(),
  await renderServerSection('MCP server — review OFF (default)', false),
  await renderServerSection('MCP server — review ON (`features.experimentalReview`)', true),
  await renderSkills(),
  await renderCliSection(),
].join('\n');

await fs.writeFile(outputPath, wrapMarkdown(document));
console.log(`Wrote ${outputPath}`);
