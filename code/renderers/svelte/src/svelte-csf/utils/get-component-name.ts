// FIXME: Unused module. Verify if it can be freely removed

// Copied from https://github.com/sveltejs/svelte/blob/14ddb87c311ff3280dde0ae44b0a0d864ec26353/packages/svelte/src/compiler/phases/2-analyze/index.js#L57-L69
export function getComponentName(filename: string) {
	const parts = filename.split(/[/\\]/);
	const basename = parts.pop() as string;
	const last_dir = parts.at(-1);
	let name = basename.replace(".svelte", "");
	if (name === "index" && last_dir && last_dir !== "src") {
		name = last_dir;
	}
	return name[0].toUpperCase() + name.slice(1);
}
