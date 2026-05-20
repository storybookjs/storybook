import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { removeTomlSection } from './toml.ts';

describe('removeTomlSection', () => {
	it('removes a plugin section and keeps surrounding config', () => {
		const input = `[marketplaces.foo]
source = "a"

[plugins."storybook@storybook"]
enabled = true

[projects."/tmp"]
trust_level = "trusted"
`;

		assert.equal(
			removeTomlSection(input, '[plugins."storybook@storybook"]'),
			`[marketplaces.foo]
source = "a"

[projects."/tmp"]
trust_level = "trusted"
`,
		);
	});

	it('returns content unchanged when the section is missing', () => {
		const input = `[marketplaces.foo]
enabled = true
`;

		assert.equal(removeTomlSection(input, '[plugins."storybook@storybook"]'), input);
	});

	it('normalizes CRLF line endings in the remaining config', () => {
		const input = `[plugins."storybook@storybook"]\r\nenabled = true\r\n\r\n[projects."/"]\r\nx = 1\r\n`;

		assert.equal(
			removeTomlSection(input, '[plugins."storybook@storybook"]'),
			`[projects."/"]\nx = 1\n`,
		);
	});
});
