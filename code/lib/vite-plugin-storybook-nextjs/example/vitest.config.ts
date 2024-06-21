import vitePluginNext from "vite-plugin-next";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [vitePluginNext()],
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: "./vitest.setup.ts",
	},
});
