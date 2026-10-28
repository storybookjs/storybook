/** Story fixtures: ArgsTable rows and the `args` of the Normal, Compact and Sections variants. */

export const STRING_ROW = {
  key: 'someString',
  name: 'Some String',
  description: 'someString description',
  type: {
    required: true,
  },
  control: {
    type: 'text',
  },
  table: {
    type: {
      summary: 'string',
    },
    defaultValue: {
      summary: 'reallylongstringnospaces',
    },
  },
} as const;

export const NUMBER_ROW = {
  key: 'someNumber',
  name: 'Some Number',
  description: 'someNumber description',
  type: {
    required: false,
  },
  table: {
    type: {
      summary: 'number',
    },
    defaultValue: {
      summary: '0',
    },
  },
  control: {
    type: 'number',
  },
} as const;

const PROPS_SECTION = { category: 'props ' };
const EVENTS_SECTION = { category: 'events ' };

export const NORMAL_ARGS = {
  rows: {
    stringType: STRING_ROW,
    numberType: NUMBER_ROW,
  },
};

export const COMPACT_ARGS = { ...NORMAL_ARGS, compact: true };

export const SECTIONS_ARGS = {
  rows: {
    a: { ...STRING_ROW, table: { ...STRING_ROW.table, ...PROPS_SECTION } },
    b: { ...NUMBER_ROW, table: { ...STRING_ROW.table, ...PROPS_SECTION } },
    c: { ...STRING_ROW, table: { ...STRING_ROW.table, ...EVENTS_SECTION } },
  },
};
