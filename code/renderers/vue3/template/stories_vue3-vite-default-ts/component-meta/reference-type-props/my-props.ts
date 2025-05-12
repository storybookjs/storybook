export interface MyNestedProps {
  /** Nested prop documentation */
  nestedProp: string;
}

export interface MyIgnoredNestedProps {
  nestedProp: string;
}

export interface MyNestedRecursiveProps {
  recursive: MyNestedRecursiveProps;
}

enum MyEnum {
  Small,
  Medium,
  Large,
}

const categories = [
  'Uncategorized',
  'Content',
  'Interaction',
  'Display',
  'Forms',
  'Addons',
] as const;

type MyCategories = (typeof categories)[number];

export interface MyProps {
  /**
   * String foo
   *
   * @since V1.0.0
   * @example
   *
   * ```vue
   * <template>
   *   <component foo="straight" />
   * </template>;
   * ```
   *
   * @default 'rounded'
   * @see https://vuejs.org/
   */
  foo: string;
  /** Optional number bar */
  bar?: number;
  /** String array baz */
  baz?: string[];
  /** Required union type */
  union: string | number;
  /** Optional union type */
  unionOptional?: string | number;
  /** Required nested object */
  nested: MyNestedProps;
  /** Required nested object with intersection */
  nestedIntersection: MyNestedProps & {
    /** Required additional property */
    additionalProp: string;
  };
  /** Optional nested object */
  nestedOptional?: MyNestedProps | MyIgnoredNestedProps;
  /** Required array object */
  array: MyNestedProps[];
  /** Optional array object */
  arrayOptional?: MyNestedProps[];
  /** Enum value */
  enumValue: MyEnum;
  /** Literal type alias that require context */
  literalFromContext: MyCategories;
  inlined: { foo: string };
  recursive: MyNestedRecursiveProps;
}

export const StringRequired = {
  type: String,
  required: true,
} as const;

export const StringEmpty = {
  type: String,
  value: '',
} as const;

export const StringUndefined = {
  type: String,
} as const;
