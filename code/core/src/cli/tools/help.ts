import * as v from 'valibot';

import {
  type AnyToolsetDefinition,
  type AnyToolsetMethod,
  type ToolsetCtx,
} from '../../shared/open-service/toolset-definition.ts';
import { parseToolsetMethodId, toCliMethodName } from '../../shared/open-service/toolset-names.ts';
import { toCatalogEntry } from './sdk/catalog.ts';
import type { ToolsetCatalog, ToolsetCatalogEntry, ToolsetCatalogMethod } from './sdk/types.ts';
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

function indented(lines: string[], depth: number): string[] {
  const pad = ' '.repeat(depth);
  // Descriptions and schema lines carry embedded newlines; every physical line gets the base
  // indent or the body's continuation lines would fall back to column 0.
  return lines.flatMap((line) => line.split('\n')).map((line) => (line ? pad + line : line));
}

function cliPath(method: ToolsetCatalogMethod): string {
  const { toolsetId, methodName } = parseToolsetMethodId(method.ref);
  return `${toolsetId} ${toCliMethodName(methodName)}`;
}

function badge(method: ToolsetCatalogMethod): string {
  return method.requiresDevServer ? DEV_SERVER_BADGE : LOCAL_BADGE;
}

function argumentLines(schema: Record<string, unknown> | undefined, flagPrefix: boolean) {
  if (schema === undefined) {
    return undefined;
  }
  return propertyLines(schema, { flagPrefix });
}

function methodBodyLines(method: ToolsetCatalogMethod): string[] {
  const lines = [method.description.trim()];
  const inputLines = argumentLines(method.input, true);
  if (inputLines === undefined) {
    lines.push('', 'Arguments: (this schema could not be rendered)');
  } else if (inputLines.length === 0) {
    lines.push('', 'Arguments: none.');
  } else {
    lines.push('', 'Arguments:', ...inputLines);
  }
  const outputLines = argumentLines(method.output, false);
  if (outputLines && outputLines.length > 0) {
    lines.push('', 'Output (`--json`):', ...outputLines);
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

function renderToolsetSection(entry: ToolsetCatalogEntry): string {
  const sections = [`${entry.id} — ${entry.description}`];
  for (const method of entry.methods) {
    const heading = `  ${cliPath(method)}  ${badge(method)}`;
    sections.push([heading, '', ...indented(methodBodyLines(method), 4)].join('\n'));
  }
  return sections.join('\n\n');
}

export function renderToolsHelpFromCatalog(catalog: ToolsetCatalog): string {
  const commands = catalog.toolsets.flatMap((toolset) =>
    toolset.methods.map((method) => ({
      path: cliPath(method),
      summary: method.title,
      badge: badge(method),
    }))
  );
  const column =
    commands.length === 0 ? 0 : Math.max(...commands.map((command) => command.path.length)) + 2;
  const commandBlock =
    commands.length === 0
      ? '  (none)'
      : commands
          .map((command) => `  ${command.path.padEnd(column)}${command.summary}  ${command.badge}`)
          .join('\n');
  const header = [
    'Usage: npx storybook tools [options] [toolset] [tool] [args...]',
    '',
    `Storybook tools from the Storybook configuration at ${catalog.configDir}.`,
    '',
    'Options:',
    ...optionLines(),
    '',
    'Commands:',
    commandBlock,
  ].join('\n');
  const notes = [
    `${LOCAL_BADGE} tools run without a running Storybook.`,
    `${DEV_SERVER_BADGE} tools need a running Storybook dev server; start it first.`,
    'Tool results print as markdown; the Output blocks below describe the `--json` data.',
    'Individual `--key value` flags override entries of `--input`.',
  ].join('\n');
  const referenceIntro =
    'Tool reference — every command in full (`npx storybook tools <toolset> <tool> --help` shows one alone):';
  const sections = [header, notes, referenceIntro];
  for (const toolset of catalog.toolsets) {
    sections.push(renderToolsetSection(toolset));
  }
  return sections.join('\n\n');
}

export function renderToolsetHelpFromCatalog(entry: ToolsetCatalogEntry): string {
  return [
    `Usage: npx storybook tools ${entry.id} <tool> [--key value ...]`,
    '',
    renderToolsetSection(entry),
  ].join('\n');
}

export function renderMethodHelpFromCatalog(
  _entry: ToolsetCatalogEntry,
  method: ToolsetCatalogMethod
): string {
  return [
    `Usage: npx storybook tools ${cliPath(method)} [--key value ...]`,
    '',
    method.requiresDevServer
      ? 'Execution: requires a running Storybook dev server; start it first.'
      : 'Execution: local (no running Storybook required).',
    '',
    ...methodBodyLines(method),
  ].join('\n');
}

/**
 * The complete agent discovery surface, in commander's conventional shape — Usage, Options, and a
 * `Commands:` listing with one-line summaries — followed by a full reference for every tool
 * (description, input schema, declared output schema) so agents learn the surface from this single
 * invocation instead of paying a project load per lookup. The flags are documented here and nowhere
 * else, since commander's own help is disabled in favor of this runtime-derived one.
 */
export function renderToolsHelp(
  configDir: string,
  toolsets: AnyToolsetDefinition[],
  ctx: ToolsetCtx
): string {
  return renderToolsHelpFromCatalog({
    configDir,
    toolsets: toolsets.map((toolset) => toCatalogEntry(toolset, ctx)),
  });
}

/** The focused view of one toolset (`storybook tools <toolset>`). */
export function renderToolsetHelp(toolset: AnyToolsetDefinition, ctx: ToolsetCtx): string {
  return renderToolsetHelpFromCatalog(toCatalogEntry(toolset, ctx));
}

/** The focused view of one tool (`storybook tools <toolset> <tool> --help`). */
export function renderMethodHelp(
  toolset: AnyToolsetDefinition,
  methodKey: string,
  method: AnyToolsetMethod,
  ctx: ToolsetCtx
): string {
  const entry = toCatalogEntry({ ...toolset, methods: { [methodKey]: method } }, ctx);
  return renderMethodHelpFromCatalog(entry, entry.methods[0] as ToolsetCatalogMethod);
}
