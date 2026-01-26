/**
 * Normalize paths to forward slashes for cross-platform compatibility
 * Storybook import paths always use forward slashes
 */
export function slash(path: string) {
	return path.replace(/\\/g, '/');
}