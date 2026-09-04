<script module>
  import { writable } from 'svelte/store';

  /**
   * HMR cycle counter. Increments on every hot-update so any `$derived`
   * that reads it is forced to re-evaluate, and any `{#key}` block keyed
   * on it tears down and re-creates its children.
   *
   * Why this is necessary: Svelte 5's `$.hmr(Component)` returns an
   * identity-stable proxy across updates. `$derived.by(() => storyFn())`
   * compares the returned `{ Component, props }` by identity, sees the
   * same proxy reference, and never re-fires — so the renderer freezes
   * on the pre-HMR component code on any non-Vite builder.
   *
   * This is scoped to webpack/Rspack on purpose. Under Vite,
   * `vite-plugin-svelte` papers over the proxy issue with its own
   * private coordination channels and performs fine-grained HMR that
   * preserves component state. Forcing a full `{#key}` remount there
   * would defeat that state preservation, so we deliberately do NOT
   * listen to `vite:afterUpdate` and let Vite's native HMR handle it.
   *
   * The webpack/Rspack status-handler API is feature-detected so a
   * single PreviewRender module works on every builder without
   * import-time errors.
   */
  const hmrTick = writable(0);

  if (typeof import.meta !== 'undefined') {
    const hot = import.meta.webpackHot ?? import.meta.hot;
    // webpack / Rspack: status transitions to 'idle' once apply finishes.
    // Vite is intentionally excluded (see comment above).
    if (hot && typeof hot.addStatusHandler === 'function') {
      let inCycle = false;
      hot.addStatusHandler((status) => {
        if (status === 'check' || status === 'prepare') {
          inCycle = true;
          return;
        }
        if (status === 'idle' && inCycle) {
          inCycle = false;
          hmrTick.update((n) => n + 1);
        }
      });
    }
  }
</script>

<script>
  /*
  ! DO NOT change this DecoratorHandler import to a relative path, it will break it.
  ! See https://github.com/storybookjs/storybook/issues/34304
  */
  import DecoratorHandler from '@storybook/svelte/internal/DecoratorHandler.svelte';
  import { dedent } from 'ts-dedent';

  const { name, title, storyFn, showError } = $props();

  // Touch `hmrTick` so the derivation re-runs on every HMR cycle. Without
  // this, `$derived.by` short-circuits when `storyFn()` returns the same
  // (identity-stable) Svelte HMR proxy reference, and new component code
  // never reaches the DOM.
  const tick = $derived($hmrTick);

  let {
    /** @type {import('svelte').SvelteComponent} */
    Component,
    props = {},
  } = $derived.by(() => {
    void tick;
    return storyFn();
  });

  $effect(() => {
    if (!Component) {
      showError({
        title: `Expecting a Svelte component from the story: "${name}" of "${title}".`,
        description: dedent`
        Did you forget to return the Svelte component configuration from the story?
        Use "() => ({ Component: YourComponent, props: {} })"
        when defining the story.
      `,
      });
    }
  });
</script>

<svelte:boundary>
  {#snippet pending()}
    <div id="sb-pending-async-component-notice">Pending async component...</div>
  {/snippet}
  {#key tick}
    <DecoratorHandler {Component} {props} />
  {/key}
</svelte:boundary>
