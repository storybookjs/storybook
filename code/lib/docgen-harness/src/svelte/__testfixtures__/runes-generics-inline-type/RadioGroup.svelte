<script lang="ts" generics="Value extends string">
  let id = $props.id();
  let {
    anchor,
    label,
    labelless = false,
    onchange,
    size,
    value,
    values,
  }: {
    /** Anchor target id. */
    anchor?: string;
    /** Visible group label. */
    label: string;
    /** Hide the visible label. */
    labelless?: boolean;
    /** Value change callback. */
    onchange: (value: Value) => void;
    /** Control size. */
    size?: 'icon' | 'wide';
    /** Selected value. */
    value: Value;
    /** Available values. */
    values: [Value, string, string?][];
  } = $props();
</script>

<fieldset {id} data-anchor={anchor} data-size={size}>
  <legend hidden={labelless}>{label}</legend>
  {#each values as [optionValue, optionLabel, optionIcon]}
    <label>
      <input
        type="radio"
        checked={optionValue === value}
        onchange={() => onchange(optionValue)}
      />
      <span>{optionIcon ?? optionLabel}</span>
    </label>
  {/each}
</fieldset>
