import { describe, it } from 'vitest';

import { definePreview } from 'storybook/internal/csf';

describe('addon parameters', () => {
  // Skip this tests - it's for the type checker only, and the preview import doesn't work in a non-DOM environment
  it.skip('are injected to csf factory', async () => {
    // Late import to prevent error referencing `Element`
    const pseudoAddon = await import('.');

    // Define preview with psuedo addon
    const preview = definePreview({ addons: [pseudoAddon.default()] });

    preview.meta({
      parameters: {
        pseudo: {
          // @ts-expect-error focus should be bool/string
          focus: 2,
        },
      },
    });
    preview.meta({
      parameters: {
        pseudo: {
          // @ts-expect-error this pseudo state doesn't exist
          madeUpKey: true,
        },
      },
    });
    // And now for something completely different - valid config
    preview.meta({
      parameters: {
        pseudo: {
          rootSelector: 'body',
          focus: true,
        },
      },
    });
  });
});
