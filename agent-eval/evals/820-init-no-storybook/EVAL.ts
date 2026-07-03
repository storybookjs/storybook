import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	isRecord,
	parseJson,
} from '#test-utils';

// Lifecycle eval (storybookjs/mcp#324): the project has no Storybook at all,
// so the storybook-init skill must drive setup. Pass criteria are the
// lifecycle outcome only — the story/review workflow is owned by the 80x
// evals on a next-stack project, because the skill installs the published
// stable release (no `storybook ai` CLI / review tools there yet).

test('invokes the storybook-init skill', () => {
	expectSkillInvoked('storybook-init');
});

// The skill's documented step 1: `npm create storybook@latest` (or the
// package-manager equivalent / the `storybook init` alias it delegates to).
test('runs the Storybook initializer', () => {
	expectShellCommandMatching(/create(-|\s+)storybook|storybook(@\S+)?\s+init/);
});

test('installs Storybook and the MCP addon', () => {
	const packageJson = parseJson(readFileSync('package.json', 'utf8'));
	if (!isRecord(packageJson)) {
		expect.fail('Expected package.json to contain a JSON object');
	}

	const dependencies = {
		...(isRecord(packageJson.dependencies) ? packageJson.dependencies : {}),
		...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
	};
	expect(dependencies.storybook, 'Expected a storybook dependency').toBeTypeOf('string');
	expect(
		dependencies['@storybook/addon-mcp'],
		'Expected the @storybook/addon-mcp dependency (skill step 2: npx storybook add @storybook/addon-mcp)',
	).toBeTypeOf('string');

	const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
	expect(scripts.storybook, 'Expected a storybook script').toBeTypeOf('string');
});

test('registers the MCP addon in the Storybook config', () => {
	const mainFile = readdirSync('.storybook').find((entry) => /^main\.[cm]?[jt]sx?$/.test(entry));
	if (mainFile === undefined) {
		expect.fail('Expected a .storybook/main config file to exist');
	}

	expect(
		readFileSync(`.storybook/${mainFile}`, 'utf8'),
		'Expected @storybook/addon-mcp to be registered in the Storybook config',
	).toContain('@storybook/addon-mcp');
});

test('the initialized Storybook boots', async () => {
	await expectStorybookBoots();
});
