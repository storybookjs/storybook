import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextConfigComplete } from "next/dist/server/config-shared.js";

const requireResolveMock = vi.hoisted(() =>
  vi.fn((id: string) => `/resolved/${id}`),
);
const loadConfigMock = vi.hoisted(() => vi.fn());
const loadJsConfigMock = vi.hoisted(() => vi.fn());
const tsconfigPathsMock = vi.hoisted(() => vi.fn());
const getExecutionEnvironmentMock = vi.hoisted(() => vi.fn());
const getNextjsMajorVersionMock = vi.hoisted(() => vi.fn());
const getViteMajorVersionMock = vi.hoisted(() => vi.fn());

vi.mock("node:module", () => ({
  createRequire: () => ({
    resolve: requireResolveMock,
  }),
}));

vi.mock("next/dist/build/load-jsconfig.js", () => ({
  default: loadJsConfigMock,
}));

vi.mock("next/dist/server/config.js", () => ({
  default: loadConfigMock,
}));

vi.mock("vite-tsconfig-paths", () => ({
  default: tsconfigPathsMock,
}));

vi.mock("./plugins/next-dynamic/plugin", () => ({
  vitePluginNextDynamic: () => ({ name: "next-dynamic" }),
}));

vi.mock("./plugins/next-env/plugin", () => ({
  vitePluginNextEnv: () => ({ name: "next-env" }),
}));

vi.mock("./plugins/next-font/plugin", () => ({
  vitePluginNextFont: () => ({ name: "next-font" }),
}));

vi.mock("./plugins/next-image/plugin", () => ({
  vitePluginNextImage: () => ({ name: "next-image" }),
}));

vi.mock("./plugins/next-mocks/plugin", () => ({
  vitePluginNextMocks: () => ({ name: "next-mocks" }),
}));

vi.mock("./plugins/next-swc/plugin", () => ({
  vitePluginNextSwc: () => ({ name: "next-swc" }),
}));

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();

  return {
    ...actual,
    getExecutionEnvironment: getExecutionEnvironmentMock,
    getNextjsMajorVersion: getNextjsMajorVersionMock,
    getViteMajorVersion: getViteMajorVersionMock,
    get isVitestEnv() {
      return process.env.VITEST === "true";
    },
  };
});

const nextConfig = {
  compiler: undefined,
} as NextConfigComplete;

describe("VitePlugin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.VITEST = "false";

    loadConfigMock.mockResolvedValue(nextConfig);
    loadJsConfigMock.mockResolvedValue({
      jsConfigPath: "/root/tsconfig.json",
    });
    tsconfigPathsMock.mockReturnValue({
      enforce: "pre",
      name: "vite-tsconfig-paths",
    });
    getExecutionEnvironmentMock.mockReturnValue("browser");
    getNextjsMajorVersionMock.mockReturnValue(16);
    getViteMajorVersionMock.mockReturnValue(7);
  });

  it("injects vite-tsconfig-paths on Vite 7 and older", async () => {
    const { default: VitePlugin } = await import("./index");

    const plugins = VitePlugin({ dir: "/root" });
    const tsconfigPlugin = await plugins[0];
    const configPlugin = plugins[1];

    expect(tsconfigPathsMock).toHaveBeenCalledWith({
      projects: ["/root/tsconfig.json"],
      root: "/root",
    });
    expect(tsconfigPlugin).toMatchObject({ name: "vite-tsconfig-paths" });
    expect(await configPlugin?.config?.({})).toMatchObject({
      resolve: {
        alias: expect.any(Array),
      },
    });
    expect((await configPlugin?.config?.({}))?.resolve).not.toHaveProperty(
      "tsconfigPaths",
    );
  });

  it("uses native tsconfig paths support on Vite 8 and newer", async () => {
    getViteMajorVersionMock.mockReturnValue(8);

    const { default: VitePlugin } = await import("./index");

    const plugins = VitePlugin({ dir: "/root" });
    const configPlugin = plugins[1];
    const config = await configPlugin?.config?.({});

    expect(plugins[0]).toBeNull();
    expect(tsconfigPathsMock).not.toHaveBeenCalled();
    expect(config).toMatchObject({
      resolve: {
        alias: expect.any(Array),
        tsconfigPaths: true,
      },
    });
  });

  it("enables native tsconfig paths in Vitest environments on Vite 8", async () => {
    process.env.VITEST = "true";
    getViteMajorVersionMock.mockReturnValue(8);

    const { default: VitePlugin } = await import("./index");

    const plugins = VitePlugin({ dir: "/root" });
    const configPlugin = plugins[1];
    const config = await configPlugin?.config?.({});

    expect(config).toMatchObject({
      resolve: {
        tsconfigPaths: true,
      },
    });
    expect(config?.resolve).not.toHaveProperty("alias");
  });
});
