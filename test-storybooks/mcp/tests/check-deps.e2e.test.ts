import { describe, it } from 'vitest';
import { x } from 'tinyexec';
import path from 'node:path';

const PACKAGES_TO_CHECK = ['@storybook/addon-docs', '@storybook/react-vite', 'storybook'];

const stripPrerelease = (version: string) => version.split(/[+-]/)[0]!;

/** When the catalog pins a PR canary (`0.0.0-pr-*`), compare against that exact version. */
const isPrCanary = (version: string) => version.startsWith('0.0.0-pr-');

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

			// PR canaries are pinned intentionally until the feature ships on @next.
			const viewTag = isPrCanary(currentVersion) ? currentVersion : '@next';
			const viewResult = await x('pnpm', ['view', `${pkg}@${viewTag}`, 'version'], {
				nodeOptions: { cwd: process.cwd() },
			});
			const latestVersion = viewResult.stdout.trim();

			// Compare only the semver core (major.minor.patch), ignoring prerelease/build suffixes
			if (stripPrerelease(currentVersion) !== stripPrerelease(latestVersion)) {
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
