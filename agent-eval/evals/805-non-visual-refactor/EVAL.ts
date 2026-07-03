import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { expectNoDisplayReview } from '#test-utils';

// Guard against a vacuous pass: skipping the review only counts if the
// refactor was actually performed. Only identifier usages count — the prompt
// renames the helper, not the file, so a module path like
// '../utils/formatRating' inside a string literal may legitimately stay.
test('performs the rename across the source tree', () => {
	const sourceFiles = readSourceFiles('src').map((file) => ({
		path: file.path,
		identifiers: stripStringLiterals(file.source),
	}));
	const filesKeepingOldName = sourceFiles
		.filter((file) => /\bformatRating\b/.test(file.identifiers))
		.map((file) => file.path);

	expect(filesKeepingOldName, 'Expected formatRating to be fully renamed to formatStars').toEqual(
		[],
	);
	expect(
		sourceFiles.some((file) => /\bformatStars\b/.test(file.identifiers)),
		'Expected the renamed formatStars helper to exist under src/',
	).toBe(true);
});

test('does not publish a display review for a non-visual refactor', () => {
	expectNoDisplayReview();
});

function stripStringLiterals(source: string): string {
	return source.replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
}

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
