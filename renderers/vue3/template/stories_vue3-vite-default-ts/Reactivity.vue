<script setup lang="ts">
defineProps<{ label: string }>();
</script>
<template>
  <div style="padding: 20px;background-color: pink;">
    <header data-testid="header-slot">
      <slot name="header" title="Header title from the slot">
        If you see this, the header slot was not reactive.
      </slot>
    </header>
    <div id="content">
      <label>
        Some input:
        <input style='width: 400px' placeholder='If you see this, an args update caused the input field to loose state' />
      </label>
      <hr>
      <button class="storybook-button storybook-button--primary storybook-button--medium"> {{ label
      }}</button>
    </div>

    <main data-testid="default-slot">
      <slot>Default slot placeholder</slot>
    </main>
    <footer data-testid="footer-slot">
      <slot name="footer">
        Footer slot placeholder
      </slot>
    </footer>
  </div>
</template>

<style>
header,
footer {
  background-color: #fff0ff;
  padding: 20px;
}

main,
#content {
  background-color: #f0f0f0;
  padding: 20px;
}
</style>
