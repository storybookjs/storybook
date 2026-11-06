<script lang="ts">
  import type { Snippet } from 'svelte';

  type LayoutProps = {
    children: Snippet;
    header: Snippet;
    footer?: Snippet;
    mainFontSize: 'small' | 'medium' | 'large';
    emphasizeHeader?: boolean;
  };

  let { children, header, footer, emphasizeHeader = false, mainFontSize }: LayoutProps = $props();
</script>

<div class="layout">
  <div class={['header', emphasizeHeader && 'emphasize']}>
    {@render header()}
  </div>
  <main
    class={[
      'main',
      {
        'font-small': mainFontSize === 'small',
        'font-medium': mainFontSize === 'medium',
        'font-large': mainFontSize === 'large',
      },
    ]}
  >
    {@render children()}
  </main>
  {#if footer}
    <div class="footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .layout > * {
    padding: 1rem;
  }

  .header,
  .footer {
    background-color: palevioletred;
    color: white;
  }

  .header.emphasize {
    background-color: red;
  }

  .main.font-small {
    font-size: 12px;
  }

  .main.font-medium {
    font-size: 16px;
  }

  .main.font-large {
    font-size: 20px;
  }
</style>
