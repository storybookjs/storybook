export const DEFAULT_SLOT_NAME = 'default';

export type ArgKeyCategory =
  | 'events'
  | 'methods'
  | 'slots'
  | 'cssParts'
  | 'cssStates'
  | 'cssProperties';

export function toArgKey(category: ArgKeyCategory, name: string): string {
  if (category === 'cssProperties') {
    return name;
  }
  return `${name}${ARG_KEY_SUFFIXES[category]}`;
}

export function parseArgKey(key: string): { category: ArgKeyCategory; name: string } | undefined {
  if (key.startsWith('--')) {
    return { category: 'cssProperties', name: key };
  }

  for (const [category, suffix] of Object.entries(ARG_KEY_SUFFIXES) as Array<
    [Exclude<ArgKeyCategory, 'cssProperties'>, string]
  >) {
    if (key.endsWith(suffix)) {
      return { category, name: key.slice(0, -suffix.length) };
    }
  }

  return undefined;
}

const ARG_KEY_SUFFIXES: Record<Exclude<ArgKeyCategory, 'cssProperties'>, string> = {
  events: '-event',
  methods: '-method',
  slots: '-slot',
  cssParts: '-part',
  cssStates: '-state',
};
