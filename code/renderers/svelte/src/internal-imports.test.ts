import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const previewRenderSource = readFileSync(
  resolve(currentDir, "../static/PreviewRender.svelte"),
  "utf8",
);

describe("published internal svelte imports", () => {
  it("keeps PreviewRender on the self-referenced DecoratorHandler import", () => {
    expect(previewRenderSource).toContain(
      "import DecoratorHandler from '@storybook/svelte/internal/DecoratorHandler.svelte';",
    );
    expect(previewRenderSource).not.toContain(
      "import DecoratorHandler from './DecoratorHandler.svelte';",
    );
  });
});
