<script>
  /**
   * Description for `sampleBoolean` component prop.
   * NOTE: The type is automatically infered.
   */
  export let sampleDefaultBoolean = false;
  /**
   * Description for `sampleOptionalBoolean` component prop.
   * @type {boolean | undefined}
   */
  export let sampleOptionalBoolean;
  /**
   * Description for `sampleRequiredBoolean` component prop.
   * @type {boolean}
   */
  export let sampleRequiredBoolean;

  /**
   * Description for `sampleDefaultString` component prop.
   * NOTE: The type is automatically infered.
   */
  export let sampleDefaultString = 'Storybook 🤝 Svelte';
  /**
   * Description for `sampleOptionalString` component prop.
   * @type {string | undefined}
   */
  export let sampleOptionalString;
  /**
   * Description for `sampleRequiredString` component prop.
   * @type {string}
   */
  export let sampleRequiredString;

  /**
   * Description for `sampleDefaultNumber` component prop.
   * NOTE: The type is automatically infered.
   */
  export let sampleDefaultNumber = 9000;
  /**
   * Description for `sampleOptionalNumber` component prop.
   * @type {number | number}
   */
  export let sampleOptionalNumber;
  /**
   * Description for `sampleRequiredNumber` component prop.
   * @type {number}
   */
  export let sampleRequiredNumber;

  /**
   * Description for `sampleDefaultArray` component prop.
   * NOTE: The type is automatically infered.
   */
  export let sampleDefaultArray = ['Storybook', 'loves', 'Svelte'];
  /**
   * Description for `sampleOptionalArray` component prop.
   * @type {string[] | undefined}
   */
  export let sampleOptionalArray;
  /**
   * Description for `sampleRequiredArray` component prop.
   * @type {string[]}
   */
  export let sampleRequiredArray;

  /**
   * @typedef Tool
   * @type {'svelte' | 'storybook'}
   */

  /**
   * Description for `sampleDefaultEnum` component prop.
   * @type {Tool}
   */
  export let sampleDefaultEnum = 'svelte';
  /**
   * Description for `sampleOptionalEnum` component prop.
   * @type {Tool | undefined}
   */
  export let sampleOptionalEnum;
  /**
   * Description for `sampleRequiredEnum` component prop.
   * @type {Tool}
   */
  export let sampleRequiredEnum;

  /**
   * Description for `sampleDefaultObject` component prop.
   * NOTE: The type is automatically infered.
   */
  export let sampleDefaultObject = {
    tool: 'svelte',
    rating: 9000,
  };
  /**
   * Description for `sampleOptionalObject` component prop.
   * @type {typeof sampleDefaultObject | undefined}
   */
  export let sampleOptionalObject;
  /**
   * Description for `sampleRequiredObject` component prop.
   * @type {typeof sampleDefaultObject}
   */
  export let sampleRequiredObject;

  $: props = {
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
  };
</script>

<code>
  {#each Object.entries(props) as [name, value]}
    <strong>{name}</strong>: {JSON.stringify(value)}<br />
  {/each}
</code>
