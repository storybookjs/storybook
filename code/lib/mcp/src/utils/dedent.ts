/**
 * Copied from https://github.com/tamino-martinius/node-ts-dedent/blob/18c4736c79806d7fe78bdaaaf5ae307b79f9574a/src/index.ts
 *
 * Rationale for vendoring instead of using the ts-dedent package:
 * 1. The package has a broken ESM distribution - the IDE auto-imports as
 *    `import dedent from 'ts-dedent'` but that breaks at runtime, requiring
 *    manual changes to named imports. See:
 *    - https://github.com/tamino-martinius/node-ts-dedent/issues/42
 *    - https://github.com/tamino-martinius/node-ts-dedent/pull/41
 * 2. Keeps bundle size smaller for such a simple utility (avoid "is-even" syndrome)
 */

export function dedent(
	templ: TemplateStringsArray | string,
	...values: unknown[]
): string {
	let strings = Array.from(typeof templ === 'string' ? [templ] : templ);

	// 1. Remove trailing whitespace.
	strings[strings.length - 1] = strings.at(-1)!.replace(/\r?\n([\t ]*)$/, '');

	// 2. Find all line breaks to determine the highest common indentation level.
	const indentLengths = strings.reduce((arr, str) => {
		const matches = str.match(/\n([\t ]+|(?!\s).)/g);
		if (matches) {
			return arr.concat(
				matches.map((match) => match.match(/[\t ]/g)?.length ?? 0),
			);
		}
		return arr;
	}, [] as number[]);

	// 3. Remove the common indentation from all strings.
	if (indentLengths.length) {
		const pattern = new RegExp(`\n[\t ]{${Math.min(...indentLengths)}}`, 'g');

		strings = strings.map((str) => str.replace(pattern, '\n'));
	}

	// 4. Remove leading whitespace.
	strings[0] = strings[0]!.replace(/^\r?\n/, '');

	// 5. Perform interpolation.
	let string = strings[0];

	values.forEach((value, i) => {
		// 5.1 Read current indentation level
		const endentations = string.match(/(?:^|\n)( *)$/);
		const endentation = endentations ? endentations[1] : '';
		let indentedValue = value;
		// 5.2 Add indentation to values with multiline strings
		if (typeof value === 'string' && value.includes('\n')) {
			indentedValue = String(value)
				.split('\n')
				.map((str, i) => {
					return i === 0 ? str : `${endentation}${str}`;
				})
				.join('\n');
		}

		string += `${indentedValue}${strings[i + 1]}`;
	});

	return string;
}
