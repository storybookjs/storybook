import { describe, it } from 'vitest';
import { x } from 'tinyexec';
import path from 'node:path';

const PACKAGES_TO_CHECK = ['@storybook/addon-docs', '@storybook/react-vite', 'storybook'];

describe('Storybook Dependencies', () => {
	it('should be using latest versions from registry', async () => {
		const outdated: Array<{ pkg: string; current: string; latest: string }> = [];

		for (const pkg of PACKAGES_TO_CHECK) {
			// Get local version
			const listResult = await x('pnpm', ['list', pkg, '--json'], {
				nodeOptions: { cwd: path.join(import.meta.dirname, '..') },
			});

			const listData = JSON.parse(listResult.stdout);
			const currentVersion =
				listData[0]?.devDependencies?.[pkg]?.version || listData[0]?.dependencies?.[pkg]?.version;

			// Get registry version for @next tag
			const viewResult = await x('pnpm', ['view', `${pkg}@next`, 'version'], {
				nodeOptions: { cwd: process.cwd() },
			});
			const latestVersion = viewResult.stdout.trim();

			// Compare versions
			if (currentVersion !== latestVersion) {
				outdated.push({ pkg, current: currentVersion, latest: latestVersion });
			}
		}

		// If there are outdated packages, fail the test with instructions
		if (outdated.length > 0) {
			const outdatedList = outdated
				.map(({ pkg, current, latest }) => `  - ${pkg}: ${current} → ${latest}`)
				.join('\n');

			const currentVersion = outdated[0]!.current.replace(/\./g, '\\.');
			const latestVersion = outdated[0]!.latest;

			throw new Error(
				`Storybook dependencies are outdated. Update the catalog in pnpm-workspace.yaml:\n\n  sed -i '' 's/${currentVersion}/${latestVersion}/g' pnpm-workspace.yaml && pnpm install\n\nOutdated packages:\n${outdatedList}`,
			);
		}
	});
});
