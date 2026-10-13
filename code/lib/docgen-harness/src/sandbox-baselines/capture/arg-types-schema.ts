import { z } from 'zod';

import type { SBType } from '../../../../../core/src/csf/SBType.ts';
import type { StrictInputType } from '../../../../../core/src/csf/story.ts';

const base = { required: z.boolean().optional(), raw: z.string().optional() };
const typeNames: ReadonlySet<string> = new Set<SBType['name']>([
  'array',
  'boolean',
  'date',
  'enum',
  'function',
  'intersection',
  'literal',
  'node',
  'number',
  'object',
  'other',
  'string',
  'symbol',
  'tuple',
  'union',
]);
const legacyType = z
  .object({ ...base, name: z.string().optional() })
  .refine((type) => type.name === undefined || !typeNames.has(type.name))
  .transform((type) => ({
    ...type,
    name: 'other' as const,
    value: type.name ?? 'undefined',
  }));
const sbType: z.ZodType<SBType, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([
    z.object({
      ...base,
      name: z.enum(['boolean', 'string', 'number', 'function', 'symbol', 'date']),
    }),
    z.object({ ...base, name: z.literal('node'), renderer: z.string() }),
    z.object({ ...base, name: z.literal('array'), value: sbType }),
    z.object({ ...base, name: z.literal('object'), value: z.record(sbType) }),
    z.object({
      ...base,
      name: z.literal('enum'),
      value: z.array(z.union([z.string(), z.number(), z.null()])),
    }),
    z.object({ ...base, name: z.enum(['intersection', 'union', 'tuple']), value: z.array(sbType) }),
    z
      .object({ ...base, name: z.literal('literal'), value: z.unknown() })
      .transform((literal) => ({ ...literal, value: literal.value })),
    z.object({ ...base, name: z.literal('other'), value: z.string() }),
    legacyType,
  ])
);
const summary = z.object({ summary: z.string().optional(), detail: z.string().optional() });
const argType: z.ZodType<StrictInputType, z.ZodTypeDef, unknown> = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    type: z.preprocess((type) => (type === null ? undefined : type), sbType.optional()),
    table: z
      .object({
        category: z.string().optional(),
        subcategory: z.string().optional(),
        disable: z.boolean().optional(),
        type: summary.optional(),
        defaultValue: summary.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export const argTypesSchema = z.record(argType);
