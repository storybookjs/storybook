<script setup lang="ts">
export interface MyNestedProps {
  /**
   * nested prop documentation
   */
  nestedProp: string;
}

interface MyIgnoredNestedProps {
  nestedProp: string;
}

interface MyNestedRecursiveProps {
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

interface MyProps {
  /**
   * string foo
   *
   * @default "rounded"
   * @since v1.0.0
   * @see https://vuejs.org/
   * @deprecated v1.1.0
   */
  foo: string;
  /**
   * description bar is optional number
   */
  bar?: number;
  /**
   * description baz is required boolean
   */
  baz: boolean;
  /**
   * description stringArray is string array
   */
  stringArray?: string[];
  /**
   * description union is required union type
   */
  union: string | number;
  /**
   * description unionOptional is optional union type
   */
  unionOptional?: string | number | boolean;
  /**
   * description nested is required nested object
   */
  nested: MyNestedProps;
  /**
   * description required nested object with intersection
   */
  nestedIntersection: MyNestedProps & {
    /**
     * description required additional property
     */
    additionalProp: string;
  };
  /**
   * description optional nested object
   */
  nestedOptional?: MyNestedProps | MyIgnoredNestedProps;
  /**
   * description required array object
   */
  array: MyNestedProps[];
  /**
   * description optional array object
   */
  arrayOptional?: MyNestedProps[];
  /**
   * description enum value
   */
  enumValue: MyEnum;
  /**
   * description literal type alias that require context
   */
  literalFromContext: MyCategories;
  inlined: { foo: string };
  recursive?: MyNestedRecursiveProps;
}

withDefaults(defineProps<MyProps>(), {
  bar: 1,
  stringArray: () => ['foo', 'bar'],
});
</script>

<template>
  <pre>{{ JSON.stringify($props, null, 2) }}</pre>
</template>
