export const ARG_TYPE_CATEGORIES = {
  attributes: 'attributes',
  properties: 'properties',
  events: 'events',
  methods: 'methods',
  slots: 'slots',
  cssProperties: 'css custom properties',
  cssParts: 'css shadow parts',
  cssStates: 'css states',
} as const;

export type ArgTypeCategory = (typeof ARG_TYPE_CATEGORIES)[keyof typeof ARG_TYPE_CATEGORIES];
