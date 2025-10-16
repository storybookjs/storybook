import { type PropDescriptor } from 'react-docgen';

import { type DocObj } from './react-docgen';

type JSONSchema =
  | (BaseSchema & { type?: JSONSchemaType | JSONSchemaType[] })
  | (BaseSchema & { oneOf?: JSONSchema[] })
  | (BaseSchema & { anyOf?: JSONSchema[] })
  | (BaseSchema & { allOf?: JSONSchema[] });

type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

interface BaseSchema {
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  deprecated?: boolean;
  'x-deprecationMessage'?: string;
  'x-internal'?: boolean;

  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  unevaluatedProperties?: boolean | JSONSchema;

  items?: JSONSchema;
  prefixItems?: JSONSchema[];
  minItems?: number;
  maxItems?: number;

  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
}

type DocgenComponent = DocObj;

type DocgenTsType =
  | { name: 'string' | 'number' | 'boolean' | 'null' | 'any' | 'unknown' }
  | {
      name: 'literal';
      value: string; // e.g. "\"sm\"" or "true" or "0"
    }
  | {
      name: 'Array';
      raw: string; // e.g. "string[]"
      elements: [DocgenTsType];
    }
  | {
      name: 'tuple';
      raw: string;
      elements: DocgenTsType[];
    }
  | {
      name: 'union';
      raw: string;
      elements: DocgenTsType[];
    }
  | {
      name: 'Record';
      raw: string;
      elements: [DocgenTsType, DocgenTsType];
    }
  | {
      name: 'signature';
      type: 'object' | 'function';
      raw: string;
      signature?: {
        arguments?: { name: string; type: DocgenTsType }[];
        return?: DocgenTsType;
        properties?: { key: string; value: DocgenTsType; description?: string }[];
      };
    }
  | { name: string; raw?: string; elements?: DocgenTsType[] }; // fallback for named refs like Tone, CSSProperties, ReactNode, Item<T>

type Options = {
  /** If true, props with @internal are dropped from the schema. Default: true */
  skipInternal?: boolean;
  /**
   * How to handle function props.
   *
   * - "skip": drop the prop (default)
   * - "string": keep as string
   * - "object": keep as empty object {}
   */
  functionProps?: 'skip' | 'string' | 'object';
  /** If true, set `additionalProperties: false` on the component schema. Default: false */
  closeObjects?: boolean;
};

const DEFAULT_OPTS: Required<Options> = {
  skipInternal: true,
  functionProps: 'skip',
  closeObjects: false,
};

/** Entry: convert an array (or single) docgen component into a map of JSON Schemas. */
export function convertReactDocgenToJSONSchemas(
  docgen: DocgenComponent,
  opts: Options = {}
): JSONSchema {
  const options = { ...DEFAULT_OPTS, ...opts };
  return convertComponent(docgen, options);
}

function convertComponent(comp: DocgenComponent, opts: Required<Options>): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const [propName, prop] of Object.entries(comp.props || {})) {
    const ann = parseAnnotations(prop.description ?? '');

    if (opts.skipInternal && (ann.internal || /@internal\b/.test(prop.description ?? ''))) {
      continue;
    }

    // Build base schema from tsType
    const schema = prop.tsType ? convertTsType(prop.tsType) : ({} as JSONSchema);

    // JSDoc annotations → JSON Schema
    applyAnnotations(schema, ann);

    // Description (strip annotation lines)
    schema.description = cleanDescription(prop.description ?? '');

    // default (from docgen defaultValue or @default tag)
    const dv = pickDefault(prop.defaultValue?.value as string, ann.default);

    if (dv !== undefined) {
      schema.default = dv;
    }

    // Mark deprecation

    // Mark deprecation
    if (ann.deprecated) {
      schema.deprecated = true;

      if (ann.deprecatedMessage) {
        schema['x-deprecationMessage'] = ann.deprecatedMessage;
      }
    }

    // Attach to properties
    properties[propName] = schema;

    // Required?
    if (prop.required) {
      required.push(propName);
    }
  }

  const result: JSONSchema = {
    type: 'object',
    properties,
  };

  if (required.length) {
    result.required = required;
  }

  if (opts.closeObjects) {
    result.additionalProperties = false;
  }

  return result;
}

/** Convert a docgen tsType subtree to JSON Schema */
function convertTsType(t: DocgenTsType): JSONSchema {
  switch (t.name) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: t.name };
    case 'null':
      return { type: 'null' };
    case 'any':
    case 'unknown':
      return {}; // unconstrained
    case 'literal': {
      // t.value can be "\"sm\"" | "true" | "0"
      const parsed = parseLiteral(t.value);
      return { const: parsed, enum: [parsed], type: jsonTypeFromValue(parsed) };
    }
    case 'Array': {
      const item = t.elements?.[0] ? convertTsType(t.elements[0]) : {};
      return { type: 'array', items: item };
    }
    case 'tuple': {
      const items = (t.elements ?? []).map(convertTsType);
      return {
        type: 'array',
        prefixItems: items,
        minItems: items.length,
        maxItems: items.length,
      };
    }
    case 'Record': {
      // elements: [keyType, valueType]
      const value = t.elements?.[1] ? convertTsType(t.elements[1]) : {};
      return {
        type: 'object',
        additionalProperties: value,
      };
    }
    case 'union': {
      // Special-case: all elements are literals → enum
      if (t.elements?.length && t.elements.every((e) => e.name === 'literal')) {
        const vals = t.elements.map((e) => parseLiteral((e as any).value));
        const types = uniq(vals.map(jsonTypeFromValue));
        const schema: JSONSchema = { enum: vals };

        if (types.length === 1) {
          schema.type = types[0];
        }
        return schema;
      }

      // Special-case: discriminated union of object signatures
      const maybe = tryDiscriminatedUnion(t.elements ?? []);

      if (maybe) {
        return maybe;
      }

      // Nullable union like (string | null)

      // Nullable union like (string | null)
      const [flatTypes, others] = partition(t.elements ?? [], (e) =>
        ['string', 'number', 'boolean', 'null'].includes(e.name)
      );
      if (flatTypes.length === t.elements?.length) {
        // a union of primitives → type: [..]
        const typeSet = uniq(
          flatTypes.map((e) => (e.name === 'number' ? 'number' : (e.name as JSONSchemaType)))
        );
        return { type: typeSet as any };
      }

      // General case → oneOf
      return {
        oneOf: (t.elements ?? []).map(convertTsType),
      };
    }
    case 'signature': {
      if ((t as any).type === 'function') {
        // Functions: by default skip — but we’ll keep as string to be safe in general usage
        // (the caller can override behavior if desired)
        return { type: 'string', description: '(function)' };
      }
      // Inline object signature
      const props = t.signature?.properties ?? [];
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];
      for (const p of props) {
        const sch = convertTsType(p.value);
        properties[p.key] = sch;

        if ((p.value as any).required) {
          required.push(p.key);
        }
      }
      const obj: JSONSchema = { type: 'object', properties };

      if (required.length) {
        obj.required = required;
      }
      return obj;
    }
    default: {
      // Named types we can heuristically map
      const raw = (t as any).raw ?? '';
      const nm = t.name;

      // Common React-ish shapes

      // Common React-ish shapes
      if (nm === 'ReactNode') {
        return {};
      } // any // any

      // any
      if (nm === 'CSSProperties') {
        return {
          type: 'object',
          additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        };
      }

      // Array-ish via raw "T[]"

      // Array-ish via raw "T[]"
      if (/\[\]$/.test(raw)) {
        return {
          type: 'array',
          items: {},
        };
      }

      // Generic-like Item<T> — we can fall back to object
      if (/[A-Za-z0-9_]+<.*>/.test(raw ?? '')) {
        return { type: 'object' };
      }

      // Fallback: if docgen didn’t expand enums/interfaces (e.g., Tone, ValidationSchema),
      // return a sensible base type:

      // Fallback: if docgen didn’t expand enums/interfaces (e.g., Tone, ValidationSchema),
      // return a sensible base type:
      if (nm === 'Tone') {
        return { type: 'string' };
      } // enum value wasn’t expanded by docgen // enum value wasn’t expanded by docgen
      if (nm === 'ValidationSchema') {
        return {
          type: 'object',
          additionalProperties: true,
          properties: {
            minLength: { type: 'number' },
            pattern: { type: 'string' },
          },
        };
      }

      // ElementType, E, TMeta → unknown

      // ElementType, E, TMeta → unknown
      if (['ElementType', 'E', 'TMeta'].includes(nm)) {
        return {};
      }

      // Last resort

      // Last resort
      return {};
    }
  }
}

/** Try to recognize discriminated union of object signatures */
function tryDiscriminatedUnion(elements: DocgenTsType[]): JSONSchema | null {
  const objects = elements.filter(
    (e) => e.name === 'signature' && (e as any).type === 'object'
  ) as any[];

  if (objects.length !== elements.length) {
    return null;
  }

  // Find a key that exists in every variant with a literal value

  // Find a key that exists in every variant with a literal value
  const candidateKeys = intersectAll(
    objects.map((o) => new Set((o.signature?.properties ?? []).map((p: any) => p.key)))
  );

  for (const key of candidateKeys) {
    const literalVals: unknown[] = [];
    let ok = true;
    for (const o of objects) {
      const prop = (o.signature?.properties ?? []).find((p: any) => p.key === key);
      if (!prop) {
        ok = false;
        break;
      }
      if (prop.value.name === 'literal') {
        literalVals.push(parseLiteral(prop.value.value));
      } else if (
        prop.value.name === 'union' &&
        prop.value.elements.length === 1 &&
        prop.value.elements[0].name === 'literal'
      ) {
        literalVals.push(parseLiteral(prop.value.elements[0].value));
      } else if (
        prop.value.name === 'boolean' ||
        prop.value.name === 'string' ||
        prop.value.name === 'number'
      ) {
        // discriminator must be a const — skip
        ok = false;
        break;
      } else {
        ok = false;
        break;
      }
    }

    if (!ok) {
      continue;
    }

    // Build oneOf with const discriminators

    // Build oneOf with const discriminators
    const oneOf = objects.map((o, i) => {
      const props = o.signature?.properties ?? [];
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      for (const p of props) {
        const sch = convertTsType(p.value);
        properties[p.key] = sch;
        // Mark discriminator required

        // Mark discriminator required
        if (p.key === key) {
          required.push(key);
        }
        // If docgen marks property as required, include (rare here)
        // If docgen marks property as required, include (rare here)

        // If docgen marks property as required, include (rare here)
        if ((p.value as any).required) {
          required.push(p.key);
        }
      }
      return {
        type: 'object',
        properties,
        required: uniq(required),
        additionalProperties: true,
      } as JSONSchema;
    });

    // JSON Schema doesn’t standardize "discriminator" (that’s OpenAPI),
    // but we can add an extension for tooling, and still rely on oneOf+const.
    return {
      oneOf,
      // @ts-expect-error OpenAPI extension for convenience
      discriminator: { propertyName: key },
    } as any;
  }

  return null;
}

/** Parse docstring annotations we support */
function parseAnnotations(desc: string) {
  const out = {
    format: undefined as string | undefined,
    minLength: undefined as number | undefined,
    maxLength: undefined as number | undefined,
    minimum: undefined as number | undefined,
    maximum: undefined as number | undefined,
    enum: undefined as unknown[] | undefined,
    deprecated: false,
    deprecatedMessage: undefined as string | undefined,
    internal: false,
    default: undefined as unknown,
  };

  const lines = desc.split(/\r?\n/);

  for (const line of lines) {
    const s = line.trim();

    // @format email
    const fmt = s.match(/^@format\s+([^\s]+)$/i);

    if (fmt) {
      out.format = fmt[1];
    }

    // @minLength 5

    // @minLength 5
    const minL = s.match(/^@minLength\s+(\d+)$/i);

    if (minL) {
      out.minLength = parseInt(minL[1], 10);
    }

    const maxL = s.match(/^@maxLength\s+(\d+)$/i);

    if (maxL) {
      out.maxLength = parseInt(maxL[1], 10);
    }

    const min = s.match(/^@minimum\s+([+-]?\d+(\.\d+)?)$/i);

    if (min) {
      out.minimum = Number(min[1]);
    }

    const max = s.match(/^@maximum\s+([+-]?\d+(\.\d+)?)$/i);

    if (max) {
      out.maximum = Number(max[1]);
    }

    // @enum {"solid" | "outline" | "ghost"}

    // @enum {"solid" | "outline" | "ghost"}
    const en = s.match(/^@enum\s+\{(.+)\}$/i);
    if (en) {
      const members = en[1]
        .split('|')
        .map((x) => x.trim())
        .map(stripQuotes);
      out.enum = members;
    }

    // @default ...
    const def = s.match(/^@default\s+(.+)$/i);
    if (def) {
      out.default = parseMaybeJSON(def[1].trim());
    }

    // @deprecated message...
    const dep = s.match(/^@deprecated(?:\s+(.+))?$/i);
    if (dep) {
      out.deprecated = true;

      if (dep[1]) {
        out.deprecatedMessage = dep[1].trim();
      }
    }

    // @internal

    // @internal
    if (/^@internal\b/i.test(s)) {
      out.internal = true;
    }
  }

  return out;
}

function applyAnnotations(schema: JSONSchema, ann: ReturnType<typeof parseAnnotations>) {
  if (ann.format) {
    schema.format = ann.format;
  }

  if (typeof ann.minLength === 'number') {
    schema.minLength = ann.minLength;
  }

  if (typeof ann.maxLength === 'number') {
    schema.maxLength = ann.maxLength;
  }

  if (typeof ann.minimum === 'number') {
    schema.minimum = ann.minimum;
  }

  if (typeof ann.maximum === 'number') {
    schema.maximum = ann.maximum;
  }

  if (ann.enum) {
    schema.enum = ann.enum;
  }

  if (ann.deprecated) {
    schema.deprecated = true;
  }

  if (ann.deprecatedMessage) {
    schema['x-deprecationMessage'] = ann.deprecatedMessage;
  }

  if (ann.internal) {
    (schema as any)['x-internal'] = true;
  }
  // don't set default here; we combine with docgen default later
  // don't set default here; we combine with docgen default later
}

function cleanDescription(s: string): string | undefined {
  const stripped = s
    .split(/\r?\n/)
    .filter((ln) => !ln.trim().startsWith('@'))
    .join('\n')
    .trim();
  return stripped || undefined;
}

function pickDefault(docgenValue?: string, jsdocDefault?: unknown) {
  if (jsdocDefault !== undefined) {
    return jsdocDefault;
  }

  if (docgenValue == null) {
    return undefined;
  }
  // docgen default value is code — try to parse simple literals
  // docgen default value is code — try to parse simple literals
  return parseMaybeJSON(docgenValue);
}

function parseLiteral(v: string): unknown {
  // v is like "\"sm\"" or "true" or "0"
  const s = v.trim();
  return parseMaybeJSON(s);
}

function parseMaybeJSON(s: string): any {
  // Try exact JSON parse first
  try {
    return JSON.parse(s);
  } catch {
    // Handle common TS defaults like Tone.Neutral, { loading: false }, etc.

    // Handle common TS defaults like Tone.Neutral, { loading: false }, etc.
    if (/^(true|false)$/i.test(s)) {
      return s.toLowerCase() === 'true';
    }

    if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
      return Number(s);
    }

    if (/^['"].*['"]$/.test(s)) {
      return stripQuotes(s);
    }

    if (s === 'null') {
      return null;
    }

    if (s === 'undefined') {
      return undefined;
    }

    // A very naive object literal strip (best-effort; keep as string if unsure)

    // A very naive object literal strip (best-effort; keep as string if unsure)
    if (/^\{[\s\S]*\}$/.test(s)) {
      try {
        // Turn TS-like to JSON-ish: single quotes → double, remove trailing commas
        const normalized = s.replace(/'/g, '"').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(normalized);
      } catch {
        return s;
      }
    }
    return s;
  }
}

function stripQuotes(x: string) {
  return x.replace(/^['"]|['"]$/g, '');
}

function jsonTypeFromValue(v: unknown): JSONSchemaType {
  if (v === null) {
    return 'null';
  }
  switch (typeof v) {
    case 'string':
      return 'string';
    case 'number':
      return Number.isInteger(v as number) ? 'integer' : 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      if (Array.isArray(v)) {
        return 'array';
      }
      return 'object';
    default:
      return 'string';
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function partition<T>(arr: T[], pred: (t: T) => boolean): [T[], T[]] {
  const a: T[] = [];
  const b: T[] = [];

  for (const x of arr) {
    (pred(x) ? a : b).push(x);
  }
  return [a, b];
}

function intersectAll(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) {
    return new Set();
  }
  const [first, ...rest] = sets;
  const out = new Set<string>(first);

  for (const s of rest) {
    for (const v of Array.from(out)) {
      if (!s.has(v)) {
        out.delete(v);
      }
    }
  }
  return out;
}
