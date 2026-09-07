/**
 * Renders JSON Schema nodes as the indented bullet lines both CLIs print under `Arguments:`, so
 * `storybook tools` and `storybook ai` describe the same schema identically.
 */
import * as v from 'valibot';

/**
 * A JSON Schema node, as far as the help renderers walk it: object `properties`, array `items`,
 * and `anyOf`/`oneOf` variants. Recursive, so the schema is built with `v.lazy` and annotated with
 * the interface (valibot can't infer a recursive type). Kept a `looseObject` so unknown JSON
 * Schema keywords pass through.
 */
export interface JsonSchemaNode {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode | JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
}

export const JsonSchemaNodeSchema: v.GenericSchema<JsonSchemaNode> = v.lazy(() =>
  v.looseObject({
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    properties: v.optional(v.record(v.string(), JsonSchemaNodeSchema)),
    required: v.optional(v.array(v.string())),
    items: v.optional(v.union([JsonSchemaNodeSchema, v.array(JsonSchemaNodeSchema)])),
    anyOf: v.optional(v.array(JsonSchemaNodeSchema)),
    oneOf: v.optional(v.array(JsonSchemaNodeSchema)),
  })
);

export const MAX_SCHEMA_DEPTH = 4;

function schemaItem(schema: JsonSchemaNode): JsonSchemaNode | undefined {
  return Array.isArray(schema.items) ? schema.items[0] : schema.items;
}

function schemaTypeLabel(schema: JsonSchemaNode): string | undefined {
  if (schema.type === 'array') {
    const item = schemaItem(schema);
    return item?.type ? `array of ${item.type}` : 'array';
  }
  if (schema.anyOf || schema.oneOf) {
    return 'one of';
  }
  return schema.type;
}

function schemaChildLines(schema: JsonSchemaNode, indent: string, depth: number): string[] {
  if (depth <= 0) {
    return [];
  }
  const lines: string[] = [];

  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required ?? []);
    for (const [name, child] of Object.entries(schema.properties)) {
      lines.push(...schemaLines(`\`${name}\``, child, required.has(name), indent, depth));
    }
  }

  const item = schemaItem(schema);
  if (item && ((item.type === 'object' && item.properties) || item.anyOf || item.oneOf)) {
    lines.push(`${indent}each item:`);
    lines.push(...schemaChildLines(item, `${indent}  `, depth - 1));
  }

  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) {
    variants.forEach((variant, index) => {
      const suffix = variant.description ? `: ${variant.description}` : '';
      lines.push(`${indent}option ${index + 1}${suffix}`);
      lines.push(...schemaChildLines(variant, `${indent}  `, depth - 1));
    });
  }

  return lines;
}

export function schemaLines(
  label: string,
  schema: JsonSchemaNode,
  isRequired: boolean,
  indent: string,
  depth: number
): string[] {
  const meta = [schemaTypeLabel(schema), isRequired ? 'required' : undefined]
    .filter(Boolean)
    .join(', ');
  const description = schema.description ? `: ${schema.description}` : '';
  const head = `${indent}- ${label}${meta ? ` (${meta})` : ''}${description}`;
  return [head, ...schemaChildLines(schema, `${indent}  `, depth - 1)];
}
