import type { Plugin } from "vite";
import { isDefined } from "./utils/typescript";

function VitePlugin(): Plugin {
	return {
		name: "vite-plugin-next",
		config(config, env) {
			const serverWatchIgnored = config.server?.watch?.ignored;
			const isServerWatchIgnoredArray = Array.isArray(serverWatchIgnored);
			return {
				server: {
					watch: {
						ignored: [
							...(isServerWatchIgnoredArray
								? serverWatchIgnored
								: [serverWatchIgnored]),
							"/.next/",
						].filter(isDefined),
					},
				},
			};
		},
	};
}

export default VitePlugin;
