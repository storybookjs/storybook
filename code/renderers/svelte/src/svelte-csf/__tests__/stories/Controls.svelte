<script lang="ts">
  type Tool = 'svelte' | 'storybook';

  interface Props {
    /**
     * Description for `sampleBoolean` component prop.
     */
    sampleDefaultBoolean: boolean;
    /**
     * Description for `sampleOptionalBoolean` component prop.
     */
    sampleOptionalBoolean: boolean | undefined;
    /**
     * Description for `sampleRequiredBoolean` component prop.
     */
    sampleRequiredBoolean: boolean;

    /**
     * Description for `sampleDefaultString` component prop.
     */
    sampleDefaultString: string;
    /**
     * Description for `sampleOptionalString` component prop.
     */
    sampleOptionalString: string | undefined;
    /**
     * Description for `sampleRequiredString` component prop.
     */
    sampleRequiredString: string;

    /**
     * Description for `sampleDefaultNumber` component prop.
     */
    sampleDefaultNumber: number;
    /**
     * Description for `sampleOptionalNumber` component prop.
     */
    sampleOptionalNumber: number | undefined;
    /**
     * Description for `sampleRequiredNumber` component prop.
     */
    sampleRequiredNumber: number;

    /**
     * Description for `sampleDefaultArray` component prop.
     */
    sampleDefaultArray: string[];
    /**
     * Description for `sampleOptionalArray` component prop.
     */
    sampleOptionalArray: string[] | undefined;
    /**
     * Description for `sampleRequiredArray` component prop.
     */
    sampleRequiredArray: string[];

    /**
     * Description for `sampleDefaultEnum` component prop.
     */
    sampleDefaultEnum: Tool;
    /**
     * Description for `sampleOptionalEnum` component prop.
     */
    sampleOptionalEnum: Tool | undefined;
    /**
     * Description for `sampleRequiredEnum` component prop.
     */
    sampleRequiredEnum: Tool;

    /**
     * Description for `sampleDefaultObject` component prop.
     */
    sampleDefaultObject: { tool: string; rating: number };
    /**
     * Description for `sampleOptionalObject` component prop.
     */
    sampleOptionalObject: { tool: string; rating: number } | undefined;
    /**
     * Description for `sampleRequiredObject` component prop.
     */
    sampleRequiredObject: { tool: string; rating: number };
  }

  let {
    sampleDefaultBoolean = false,
    sampleOptionalBoolean,
    sampleRequiredBoolean,

    sampleDefaultString = 'Storybook 🤝 Svelte',
    sampleOptionalString,
    sampleRequiredString,

    sampleDefaultNumber = 9000,
    sampleOptionalNumber,
    sampleRequiredNumber,

    sampleDefaultArray = ['Storybook', 'loves', 'Svelte'],
    sampleOptionalArray,
    sampleRequiredArray,

    sampleDefaultEnum = 'svelte',
    sampleOptionalEnum,
    sampleRequiredEnum,

    sampleDefaultObject = { tool: 'storybook', rating: 9000 },
    sampleOptionalObject,
    sampleRequiredObject,
  }: Props = $props();

  let properties = $derived({
    sampleDefaultBoolean,
    sampleOptionalBoolean,
    sampleRequiredBoolean,

    sampleDefaultString,
    sampleOptionalString,
    sampleRequiredString,

    sampleDefaultNumber,
    sampleOptionalNumber,
    sampleRequiredNumber,

    sampleDefaultArray,
    sampleOptionalArray,
    sampleRequiredArray,

    sampleDefaultEnum,
    sampleOptionalEnum,
    sampleRequiredEnum,

    sampleDefaultObject,
    sampleOptionalObject,
    sampleRequiredObject,
  });
</script>

<code>
  {#each Object.entries(properties) as [name, value] (name)}
    <strong>{name}</strong>: {JSON.stringify(value)}<br />
  {/each}
</code>
