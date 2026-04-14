import { describe, expect, it } from "vitest";

import { loadCsf } from "storybook/internal/csf-tools";

import { extractDeclaredSubcomponents } from "./subcomponents.ts";

describe("extractDeclaredSubcomponents", () => {
  it("does not loop forever on circular identifier references", () => {
    const csf = loadCsf(
      `
        import type { Meta } from '@storybook/react';
        import { Button } from './Button';

        const LoopA = LoopB;
        const LoopB = LoopA;
        const Item = Button;

        const meta = {
          component: Button,
          subcomponents: {
            Loop: LoopA,
            Item,
          },
        } satisfies Meta<typeof Button>;

        export default meta;
      `,
      { makeTitle: (title) => title },
    ).parse();

    expect(extractDeclaredSubcomponents(csf)).toEqual([
      { name: "Loop", componentName: "LoopA" },
      { name: "Item", componentName: "Item" },
    ]);
  });
});
