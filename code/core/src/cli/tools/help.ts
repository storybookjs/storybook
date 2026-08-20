import * as v from 'valibot';

import {
  resolveToolsetDescription,
  type AnyToolsetDefinition,
  type AnyToolsetMethod,
  type ToolsetCtx,
} from '../../shared/open-service/toolset-definition.ts';
import { toCliMethodName } from '../../shared/open-service/toolset-names.ts';
import { toToolsetJsonSchema } from './sdk/json-schema.ts';
import {
  JsonSchemaNodeSchema,
  MAX_SCHEMA_DEPTH,
  schemaLines,
  type JsonSchemaNode,
} from './schema-lines.ts';
import { TOOLS_OPTION_SPECS } from './tool-tokens.ts';

const LOCAL_BADGE = '[local]';
const DEV_SERVER_BADGE = '[requires running Storybook]';

function optionLines(): string[] {
  const column = Math.max(...TOOLS_OPTION_SPECS.map((spec) => spec.flags.length)) + 2;
  return TOOLS_OPTION_SPECS.map((spec) => `  ${spec.flags.padEnd(column)}${spec.description}`);
}

/**
 * One line per tool for the `Commands:` listing, in commander's shape: the subcommand padded to a
 * shared column, a one-sentence summary, and the execution badge.
 */
function commandLines(toolsets: AnyToolsetDefinition[], ctx: ToolsetCtx): string[] {
  const commands = toolsets.flatMap((toolset) =>
    Object.entries(toolset.methods).map(([methodKey, method]) => ({
      path: cliPath(toolset, methodKey),
      summary: method.title,
      badge: badge(method),
    }))
  );
  const column = Math.max(...commands.map((command) => command.path.length)) + 2;
  return commands.map(
    (command) => `  ${command.path.padEnd(column)}${command.summary}  ${command.badge}`
  );
}

function indented(lines: string[], depth: number): string[] {
  const pad = ' '.repeat(depth);
  // Descriptions and schema lines carry embedded newlines; every physical line gets the base
  // indent or the body's continuation lines would fall back to column 0.
  return lines.flatMap((line) => line.split('\n')).map((line) => (line ? pad + line : line));
}

function cliPath(toolset: AnyToolsetDefinition, methodKey: string): string {
  return `${toolset.id} ${toCliMethodName(methodKey)}`;
}

/**
 * The complete agent discovery surface, in commander's conventional shape — Usage, Options, and a
 * `Commands:` listing with one-line summaries — followed by a full reference for every tool
 * (description, input schema, declared output schema) so agents learn the surface from this single
 * invocation instead of paying a project load per lookup. The Options block is the flags' only
 * documentation, since commander's own help is disabled in favor of this runtime-derived one.
 */
export function renderToolsHelp(
  configDir: string,
  toolsets: AnyToolsetDefinition[],
  ctx: ToolsetCtx
): string {
  const header = [
    'Usage: npx storybook tools [options] [toolset] [tool] [args...]',
    '',
    `Storybook tools from the Storybook configuration at ${configDir}.`,
    '',
    'Options:',
    ...optionLines(),
    '',
    'Commands:',
    ...commandLines(toolsets, ctx),
  ].join('\n');
  const notes = [
    `${LOCAL_BADGE} tools run in this process, without a running Storybook.`,
    `${DEV_SERVER_BADGE} tools need a running Storybook dev server; start it first.`,
    'Individual `--key value` flags override entries of `--input`.',
  ].join('\n');
  const referenceIntro =
    'Tool reference — every command in full (`npx storybook tools <toolset> <tool> --help` shows one alone):';
  const sections = [header, notes, referenceIntro];
  for (const toolset of toolsets) {
    sections.push(renderToolsetSection(toolset, ctx));
  }
  return sections.join('\n\n');
}

/** The focused view of one toolset (`storybook tools <toolset>`). */
export function renderToolsetHelp(toolset: AnyToolsetDefinition, ctx: ToolsetCtx): string {
  return [
    `Usage: npx storybook tools ${toolset.id} <tool> [--key value ...]`,
    '',
    renderToolsetSection(toolset, ctx),
  ].join('\n');
}

/** One toolset's section of the reference dump. */
function renderToolsetSection(toolset: AnyToolsetDefinition, ctx: ToolsetCtx): string {
  const sections = [`${toolset.id} — ${toolset.description}`];
  for (const [methodKey, method] of Object.entries(toolset.methods)) {
    const heading = `  ${cliPath(toolset, methodKey)}  ${badge(method)}`;
    sections.push([heading, '', ...indented(methodBodyLines(method, ctx), 4)].join('\n'));
  }
  return sections.join('\n\n');
}

/** The focused view of one tool (`storybook tools <toolset> <tool> --help`). */
export function renderMethodHelp(
  toolset: AnyToolsetDefinition,
  methodKey: string,
  method: AnyToolsetMethod,
  ctx: ToolsetCtx
): string {
  const lines = [
    `Usage: npx storybook tools ${cliPath(toolset, methodKey)} [--key value ...]`,
    '',
    method.requiresDevServer
      ? 'Execution: requires a running Storybook dev server; start it first.'
      : 'Execution: local (no running Storybook required).',
    '',
    ...methodBodyLines(method, ctx),
  ];
  return lines.join('\n');
}

function badge(method: AnyToolsetMethod): string {
  return method.requiresDevServer ? DEV_SERVER_BADGE : LOCAL_BADGE;
}

function methodBodyLines(method: AnyToolsetMethod, ctx: ToolsetCtx): string[] {
  const lines = [resolveToolsetDescription(method.description, ctx).trim()];

  const inputSchema = toToolsetJsonSchema(method.input);
  const argumentLines = inputSchema ? propertyLines(inputSchema, { flagPrefix: true }) : undefined;
  if (argumentLines === undefined) {
    lines.push('', 'Arguments: (this schema could not be rendered)');
  } else if (argumentLines.length === 0) {
    lines.push('', 'Arguments: none.');
  } else {
    lines.push('', 'Arguments:', ...argumentLines);
  }

  if (method.output) {
    const outputSchema = toToolsetJsonSchema(method.output);
    const outputLines = outputSchema ? propertyLines(outputSchema, { flagPrefix: false }) : [];
    if (outputLines.length > 0) {
      lines.push('', 'Output:', ...outputLines);
    }
  }

  return lines;
}

function propertyLines(
  schema: Record<string, unknown>,
  { flagPrefix }: { flagPrefix: boolean }
): string[] {
  const properties = Object.entries(
    (schema.properties as Record<string, unknown> | undefined) ?? {}
  );
  const required = new Set((schema.required as string[] | undefined) ?? []);
  const lines: string[] = [];
  for (const [name, propertySchema] of properties) {
    // Validate at this boundary: an unmodeled schema shape falls back to an empty node instead of
    // dropping the property or failing the help output.
    const parsed = v.safeParse(JsonSchemaNodeSchema, propertySchema);
    const node: JsonSchemaNode = parsed.success ? parsed.output : {};
    const label = flagPrefix ? `\`--${name}\`` : `\`${name}\``;
    lines.push(...schemaLines(label, node, required.has(name), '', MAX_SCHEMA_DEPTH));
  }
  return lines;
}
