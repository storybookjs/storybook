import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { expectNoDisplayReview } from '#test-utils';

// Trigger correctness, negative branch (Agentic Review Eval instructions
// §6a.1 / §7 branch 3): a pure rename with no behavior change must not
// publish a review.

// Guard against a vacuous pass: skipping the review only counts if the
// refactor was actually performed.
test('performs the rename across the source tree', () => {
	const sourceFiles = readSourceFiles('src');
	const filesKeepingOldName = sourceFiles
		.filter((file) => file.source.includes('formatRating'))
		.map((file) => file.path);

	expect(filesKeepingOldName, 'Expected formatRating to be fully renamed to formatStars').toEqual(
		[],
	);
	expect(
		sourceFiles.some((file) => file.source.includes('formatStars')),
		'Expected the renamed formatStars helper to exist under src/',
	).toBe(true);
});

test('does not publish a display review for a non-visual refactor', () => {
	expectNoDisplayReview();
});

function readSourceFiles(dir: string): Array<{ path: string; source: string }> {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			return readSourceFiles(entryPath);
		}
		return /\.[jt]sx?$/.test(entry.name)
			? [{ path: entryPath, source: readFileSync(entryPath, 'utf8') }]
			: [];
	});
}
