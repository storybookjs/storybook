// The `v-bind="args"` of a live snippet template, which the story-docs provider writes and
// `fillTemplate` reads. It names the component's slots, so a slot arg fills in as slot content:
// `v-bind="args /* slots: default, header */"`.
export const argsSpread = (slots: readonly string[]) =>
  `v-bind="args${slots.length > 0 ? ` /* slots: ${slots.join(', ')} */` : ''}"`;

const ARGS_SPREAD = /^\s*args\s*(?:\/\*\s*slots:([^*]*)\*\/\s*)?$/;

// The slots an `argsSpread` value names, or `undefined` for any other value.
export function readArgsSpread(value: string): string[] | undefined {
  const spread = ARGS_SPREAD.exec(value);
  return spread ? (spread[1]?.split(',').map((slot) => slot.trim()) ?? []) : undefined;
}
