export type ArgKeySuffix = (typeof ARG_KEY_SUFFIXES)[keyof typeof ARG_KEY_SUFFIXES];

export const ARG_KEY_SUFFIXES = {
  events: '-event',
  methods: '-method',
  slots: '-slot',
  cssParts: '-part',
  cssStates: '-state',
} as const;
