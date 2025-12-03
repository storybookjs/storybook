import { beforeEach, describe, expect, it, vi } from "vitest";

import type loadJsConfig from "next/dist/build/load-jsconfig.js";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";

vi.mock("next/dist/build/load-jsconfig.js", () => ({
  default: vi.fn(),
}));

vi.mock("next/dist/build/swc/index.js", () => ({
  transform: vi.fn(),
}));

vi.mock("../../utils/nextjs", () => ({
  findNextDirectories: vi.fn(),
  loadClosestPackageJson: vi.fn(),
  loadSWCBindingsEagerly: vi.fn(),
}));

vi.mock("../../utils/swc/transform", () => ({
  getVitestSWCTransformConfig: vi.fn(),
}));

const createPromiseWithResolvers = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const nextConfig: NextConfigComplete = {
  // Only the fields read by our code under test are populated here.
  experimental: {
    swcPlugins: [],
  },
  modularizeImports: undefined,
  compiler: undefined,
  distDir: ".next",
  // biome-ignore lint/suspicious/noExplicitAny: we only need a partial shape for this test
} as any;

describe("vitePluginNextSwc env detection", () => {
  const setupMocks = async () => {
    const loadJsConfigModule = await import("next/dist/build/load-jsconfig.js");
    vi.mocked(loadJsConfigModule.default).mockResolvedValue({
      useTypeScript: true,
      jsConfig: { compilerOptions: {} },
      resolvedBaseUrl: undefined,
    } as unknown as Awaited<ReturnType<typeof loadJsConfig>>);

    const NextUtils = await import("../../utils/nextjs");
    vi.mocked(NextUtils.findNextDirectories).mockReturnValue({
      pagesDir: "/pages",
      appDir: "/app",
    });
    vi.mocked(NextUtils.loadClosestPackageJson).mockResolvedValue({
      type: "module",
    });
    vi.mocked(NextUtils.loadSWCBindingsEagerly).mockResolvedValue(undefined);

    const swc = await import("next/dist/build/swc/index.js");
    vi.mocked(swc.transform).mockResolvedValue({
      code: "export {}",
      map: null,
    });

    const swcTransform = await import("../../utils/swc/transform");
    vi.mocked(swcTransform.getVitestSWCTransformConfig).mockReturnValue(
      {} as ReturnType<typeof swcTransform.getVitestSWCTransformConfig>,
    );
  };

  it("treats Storybook-like Vite config (no `test` field) as browser, not server", async () => {
    // In Storybook, VITEST is not set; in our unit test runner it is, so we explicitly simulate Storybook.
    process.env.VITEST = "false";
    vi.resetModules();
    await setupMocks();

    const { vitePluginNextSwc } = await import("./plugin");

    const nextConfigResolver = createPromiseWithResolvers<NextConfigComplete>();
    nextConfigResolver.resolve(nextConfig);

    const plugin = vitePluginNextSwc("/root", nextConfigResolver);

    await plugin.config?.({}, { mode: "development" } as never);

    await plugin.transform?.call(
      { getCombinedSourcemap: () => null } as unknown as ThisParameterType<
        NonNullable<typeof plugin.transform>
      >,
      "export const x = typeof window;",
      "/src/example.ts",
    );

    const swcTransform = await import("../../utils/swc/transform");
    const lastCallArg = vi
      .mocked(swcTransform.getVitestSWCTransformConfig)
      .mock.calls.at(-1)?.[0];

    expect(lastCallArg?.isServerEnvironment).toBe(false);
  });

  it("treats Vitest node environment as server", async () => {
    process.env.VITEST = "true";
    vi.resetModules();
    await setupMocks();

    const { vitePluginNextSwc } = await import("./plugin");

    const nextConfigResolver = createPromiseWithResolvers<NextConfigComplete>();
    nextConfigResolver.resolve(nextConfig);

    const plugin = vitePluginNextSwc("/root", nextConfigResolver);

    await plugin.config?.({ test: { environment: "node" } }, {
      mode: "development",
    } as never);

    await plugin.transform?.call(
      { getCombinedSourcemap: () => null } as unknown as ThisParameterType<
        NonNullable<typeof plugin.transform>
      >,
      "export const x = typeof window;",
      "/src/example.ts",
    );

    const swcTransform = await import("../../utils/swc/transform");
    const lastCallArg = vi
      .mocked(swcTransform.getVitestSWCTransformConfig)
      .mock.calls.at(-1)?.[0];

    expect(lastCallArg?.isServerEnvironment).toBe(true);
  });
});
