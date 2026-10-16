<script lang="ts">
  import type { PanelConfig } from './types.ts';

  interface Props {
    /** Required panel config. */
    config: PanelConfig;
    /** Item labels. */
    items?: string[];
    /** Lookup table. */
    lookup?: Record<string, number>;
    /** Numeric pair. */
    pair?: [number, number];
    /** Partial state override. */
    state?: Partial<PanelConfig> & { open: boolean };
    /** Activation time. */
    when?: Date;
  }

  let {
    config,
    items = [],
    lookup,
    pair,
    state,
    when,
  }: Props = $props();
</script>

<section>
  <h2>{config.id}</h2>
  <p>{items.join(',')}</p>
  <p>{JSON.stringify(lookup)} {JSON.stringify(pair)} {state?.open} {when?.toISOString()}</p>
</section>
