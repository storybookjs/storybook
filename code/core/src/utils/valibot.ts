// The schema functions `storybook`'s Node code uses, re-exported so it shares core's bundled copy.
export {
  array,
  boolean,
  integer,
  lazy,
  literal,
  looseObject,
  maxValue,
  message,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  record,
  regex,
  safeParse,
  string,
  summarize,
  transform,
  trim,
  union,
} from 'valibot';
// Types the d.ts of schemas built from these functions name; a missing one fails declaration emit.
export type {
  GenericSchema,
  InferOutput,
  MaxValueAction,
  RegexAction,
  TransformAction,
  TrimAction,
} from 'valibot';
