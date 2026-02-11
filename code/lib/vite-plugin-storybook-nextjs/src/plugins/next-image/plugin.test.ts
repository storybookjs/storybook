import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const requireResolveMock = vi.fn();

vi.mock("node:module", () => ({
  createRequire: () => ({
    resolve: requireResolveMock,
  }),
}));

import { vitePluginNextImage } from "./plugin";

describe("vitePluginNextImage resolveId", () => {
  const nextConfigResolver = {
    promise: Promise.resolve({}),
    resolve: vi.fn(),
    reject: vi.fn(),
  } as PromiseWithResolvers<unknown>;

  it("resolves relative image imports against importer", async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const resolve = vi.fn();
    const importer = "/project/src/Component.tsx";

    const result = await plugin.resolveId!.call(
      { resolve },
      "./images/avatar.png",
      importer,
    );

    expect(resolve).not.toHaveBeenCalled();
    expect(result).toBe(
      `virtual:next-image?imagePath=${path.join(
        path.dirname(importer),
        "./images/avatar.png",
      )}`,
    );
  });

  it("uses Vite resolver for package image imports", async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const resolvedPath = "/project/packages/assets/src/images/avatar.png";
    const resolve = vi.fn().mockResolvedValue({ id: resolvedPath });

    const result = await plugin.resolveId!.call(
      { resolve },
      "@myorg/assets/images/avatar.png",
      "/project/src/Component.tsx",
    );

    expect(resolve).toHaveBeenCalledWith(
      "@myorg/assets/images/avatar.png",
      "/project/src/Component.tsx",
      { skipSelf: true },
    );
    expect(result).toBe(`virtual:next-image?imagePath=${resolvedPath}`);
  });

  it("falls back to require.resolve when Vite resolution fails", async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const importer = "/project/src/Component.tsx?import";
    const resolvedPath = "/project/packages/assets/src/images/avatar.png";
    const resolve = vi.fn().mockResolvedValue(null);

    requireResolveMock.mockReturnValueOnce(resolvedPath);

    const result = await plugin.resolveId!.call(
      { resolve },
      "@myorg/assets/images/avatar.png",
      importer,
    );

    expect(resolve).toHaveBeenCalled();
    expect(requireResolveMock).toHaveBeenCalledWith(
      "@myorg/assets/images/avatar.png",
      { paths: [path.dirname(importer.split("?")[0])] },
    );
    expect(result).toBe(`virtual:next-image?imagePath=${resolvedPath}`);
  });
});
