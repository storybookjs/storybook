import next from "vite-plugin-next";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [next()],
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: "./vitest.setup.ts",
	},
});
