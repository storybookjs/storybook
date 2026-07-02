import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';

import { isRecord } from './shell-parse.ts';

type FixturePackageJson = {
	evals?: {
		template?: unknown;
		pinStorybook?: unknown;
	};
};

type EvalAgent = 'claude-code' | 'codex';
type EvalIntegration = 'mcp' | 'plugin';
type Catalog = Record<string, string>;
type DependencyOverrides = Record<string, string>;
type TemplateMetadata = {
	amazonLinuxPackages?: unknown;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(AGENT_EVAL_ROOT, '..');
const TEMPLATES_DIR = path.join(AGENT_EVAL_ROOT, 'templates');
const TEMPLATE_METADATA_FILE = 'eval-template.json';
const PREVIEW_BROWSER_MOCK_SOURCE_PATH = path.join(
	AGENT_EVAL_ROOT,
	'lib',
	'mcp',
	'preview-browser-mock.mjs',
);
const PREVIEW_BROWSER_MOCK_SANDBOX_PATH = path.posix.join(
	'.agent-eval',
	'mcp',
	'preview-browser-mock.mjs',
);
const NODE_REPL_MOCK_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'mcp', 'node-repl-mock.mjs');
const NODE_REPL_MOCK_SANDBOX_PATH = path.posix.join('.agent-eval', 'mcp', 'node-repl-mock.mjs');
const CODEX_BROWSER_MOCK_SOURCE_PATH = path.join(
	AGENT_EVAL_ROOT,
	'lib',
	'mcp',
	'codex-browser-client-mock.mjs',
);
const CODEX_BROWSER_MOCK_SANDBOX_PATH = path.posix.join(
	'.agent-eval',
	'mcp',
	'codex-browser-client-mock.mjs',
);
const CODEX_BROWSER_API_SOURCE_PATH = path.join(
	AGENT_EVAL_ROOT,
	'lib',
	'mcp',
	'codex-browser-api.json',
);
const CODEX_BROWSER_API_SANDBOX_PATH = path.posix.join(
	'.agent-eval',
	'mcp',
	'codex-browser-api.json',
);
const CODEX_BROWSER_SKILL_SOURCE_PATH = path.join(
	AGENT_EVAL_ROOT,
	'lib',
	'mcp',
	'codex-browser-skill.md',
);
const CODEX_BROWSER_SKILL_SANDBOX_PATH = path.posix.join(
	'.agents',
	'skills',
	'control-in-app-browser',
	'SKILL.md',
);
const START_STORYBOOK_SCRIPT_SOURCE_PATH = path.join(
	AGENT_EVAL_ROOT,
	'lib',
	'mcp',
	'start-storybook-mcp.mjs',
);
const START_STORYBOOK_SCRIPT_SANDBOX_PATH = path.posix.join('scripts', 'start-storybook-mcp.mjs');
const TRANSCRIPT_HELPER_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'test-utils.ts');
const TRANSCRIPT_HELPER_SANDBOX_PATH = path.posix.join('__agent_eval__', 'test-utils.ts');
// test-utils.ts imports ./shell-parse.ts, so the sandbox copy needs both files.
const SHELL_PARSE_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'shell-parse.ts');
const SHELL_PARSE_SANDBOX_PATH = path.posix.join('__agent_eval__', 'shell-parse.ts');
const AGENT_CONTEXT_SANDBOX_PATH = path.posix.join('__agent_eval__', 'agent.json');
const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STORYBOOK_MCP_SERVER_NAME = 'storybook-dev-mcp';
const STORYBOOK_MCP_URL = 'http://127.0.0.1:6006/mcp';
const PREVIEW_BROWSER_MCP_SERVER_NAME = 'preview-browser';
const CLAUDE_MCP_CONFIG_PATH = '.mcp.json';
const CODEX_CONFIG_PATH = '.codex/config.toml';
const CLAUDE_PLUGIN_SKILLS_DIR = path.join(REPO_ROOT, 'packages', 'claude-plugin', 'skills');
const CODEX_PLUGIN_SKILLS_DIR = path.join(
	REPO_ROOT,
	'packages',
	'codex-plugin',
	'plugins',
	'storybook',
	'skills',
);

export async function setupSandbox(
	sandbox: Sandbox,
	options: { agent: EvalAgent; integration: EvalIntegration },
): Promise<void> {
	await writeEvalSupportFiles(sandbox, options);

	const packageJson = await readFixturePackageJson(sandbox);
	const fixtureFiles = await readSandboxWorkspaceFiles(sandbox);
	const templateName = packageJson.evals?.template;

	if (templateName === undefined) {
		return;
	}

	if (typeof templateName !== 'string' || templateName.length === 0) {
		throw new Error('Expected package.json evals.template to be a non-empty string');
	}

	if (!TEMPLATE_NAME_PATTERN.test(templateName)) {
		throw new Error(
			'Expected package.json evals.template to contain only lowercase letters, numbers, and hyphens',
		);
	}

	const templateDir = path.join(TEMPLATES_DIR, templateName);
	const templateMetadata = await readTemplateMetadata(templateDir);
	let files = await readTemplateFiles(templateDir);

	if (Object.keys(files).length === 0) {
		throw new Error(`Template "${templateName}" does not contain any files`);
	}

	files = mergeTemplateAndFixtureFiles(files, fixtureFiles);

	// Fixtures that intentionally ship an outdated Storybook (the upgrade-skill
	// evals) opt out of pinning with `evals.pinStorybook: false`; everything
	// else is pinned to the dist-tag so result snapshots record exact versions.
	if (packageJson.evals?.pinStorybook !== false) {
		await pinStorybookPackages(
			files,
			process.env.EVAL_STORYBOOK_LATEST === '1' ? 'latest' : 'next',
		);
	}

	if (usesLocalStorybookMcpPackages(files)) {
		Object.assign(files, await readLocalStorybookMcpPackages());
	}

	// The Storybook-starting postinstall script is maintained once in lib/mcp
	// and injected wherever a package.json references it, so the templates and
	// fixtures cannot drift apart.
	if (referencesStartStorybookScript(files)) {
		files[START_STORYBOOK_SCRIPT_SANDBOX_PATH] = await fs.readFile(
			START_STORYBOOK_SCRIPT_SOURCE_PATH,
			'utf8',
		);
	}

	await setupTemplateSandbox(sandbox, templateMetadata);
	await sandbox.writeFiles(files);
}

async function writeEvalSupportFiles(
	sandbox: Sandbox,
	options: { agent: EvalAgent; integration: EvalIntegration },
): Promise<void> {
	await sandbox.writeFiles({
		[TRANSCRIPT_HELPER_SANDBOX_PATH]: await fs.readFile(TRANSCRIPT_HELPER_SOURCE_PATH, 'utf8'),
		[SHELL_PARSE_SANDBOX_PATH]: await fs.readFile(SHELL_PARSE_SOURCE_PATH, 'utf8'),
		[AGENT_CONTEXT_SANDBOX_PATH]: JSON.stringify(
			{
				agent: options.agent,
				integration: options.integration,
			},
			null,
			2,
		).concat('\n'),
	});
}

async function readFixturePackageJson(sandbox: Sandbox): Promise<FixturePackageJson> {
	const content = await sandbox.readFile('package.json');
	const packageJson = JSON.parse(content) as unknown;

	if (!isRecord(packageJson)) {
		throw new Error('Fixture package.json must contain a JSON object');
	}

	return packageJson as FixturePackageJson;
}

async function readTemplateFiles(templateDir: string): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	await collectFiles({
		sourceDir: templateDir,
		targetDir: '',
		files,
		exclude: (filePath) => filePath === TEMPLATE_METADATA_FILE,
	});
	return files;
}

async function readTemplateMetadata(templateDir: string): Promise<TemplateMetadata> {
	const metadataPath = path.join(templateDir, TEMPLATE_METADATA_FILE);

	try {
		const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as unknown;
		if (!isRecord(metadata)) {
			throw new Error(`${metadataPath} must contain a JSON object`);
		}
		return metadata;
	} catch (error) {
		if (isNodeError(error) && error.code === 'ENOENT') {
			return {};
		}
		throw error;
	}
}

async function readSandboxWorkspaceFiles(sandbox: Sandbox): Promise<Record<string, string>> {
	const result = await sandbox.runCommand('bash', [
		'-lc',
		[
			'find . -type f',
			'  ! -path "./.git/*"',
			'  ! -path "./node_modules/*"',
			'  ! -path "./__agent_eval__/*"',
			'  ! -name "PROMPT.md"',
			'  ! -name "EVAL.ts"',
			'  ! -name "EVAL.tsx"',
			'  -print',
		].join(' \\\n'),
	]);

	if (result.exitCode !== 0) {
		throw new Error(`Failed to list fixture files in sandbox: ${result.stderr || result.stdout}`);
	}

	const files: Record<string, string> = {};
	for (const rawPath of result.stdout.split('\n')) {
		const filePath = rawPath.trim().replace(/^\.\//, '');
		if (filePath.length === 0) {
			continue;
		}
		files[filePath] = await sandbox.readFile(filePath);
	}

	return files;
}

function mergeTemplateAndFixtureFiles(
	templateFiles: Record<string, string>,
	fixtureFiles: Record<string, string>,
): Record<string, string> {
	const files = { ...templateFiles };

	for (const [filePath, fixtureContent] of Object.entries(fixtureFiles)) {
		const templateContent = templateFiles[filePath];
		if (templateContent === undefined || !filePath.endsWith('.json')) {
			files[filePath] = fixtureContent;
			continue;
		}

		const merged = deepMergeJson(
			parseJsonFile(filePath, templateContent, 'template'),
			parseJsonFile(filePath, fixtureContent, 'fixture'),
		);
		files[filePath] = JSON.stringify(merged, null, 2).concat('\n');
	}

	return files;
}

function parseJsonFile(filePath: string, content: string, source: 'fixture' | 'template'): unknown {
	try {
		return JSON.parse(content) as unknown;
	} catch (error) {
		throw new Error(
			`Failed to parse ${source} JSON file ${filePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

function deepMergeJson(templateValue: unknown, fixtureValue: unknown): unknown {
	if (!isRecord(templateValue) || !isRecord(fixtureValue)) {
		return fixtureValue;
	}

	const result: Record<string, unknown> = { ...templateValue };
	for (const [key, value] of Object.entries(fixtureValue)) {
		result[key] = key in result ? deepMergeJson(result[key], value) : value;
	}

	return result;
}

// The system libraries Playwright's chromium needs on the Amazon Linux
// sandbox image. Shared by every template that runs story tests, referenced
// from eval-template.json as `"amazonLinuxPackages": "playwright-chromium"`.
const PLAYWRIGHT_CHROMIUM_AMAZON_LINUX_PACKAGES = [
	'alsa-lib',
	'at-spi2-atk',
	'at-spi2-core',
	'atk',
	'cairo',
	'cups-libs',
	'dbus-libs',
	'libX11',
	'libXcomposite',
	'libXdamage',
	'libXext',
	'libXfixes',
	'libXrandr',
	'libxcb',
	'libxkbcommon',
	'mesa-libgbm',
	'nspr',
	'nss',
	'pango',
];

async function setupTemplateSandbox(
	sandbox: Sandbox,
	templateMetadata: TemplateMetadata,
): Promise<void> {
	const amazonLinuxPackages =
		templateMetadata.amazonLinuxPackages === 'playwright-chromium'
			? PLAYWRIGHT_CHROMIUM_AMAZON_LINUX_PACKAGES
			: templateMetadata.amazonLinuxPackages;
	if (amazonLinuxPackages === undefined) {
		return;
	}

	if (
		!Array.isArray(amazonLinuxPackages) ||
		!amazonLinuxPackages.every(
			(packageName) => typeof packageName === 'string' && /^[a-zA-Z0-9_.+-]+$/.test(packageName),
		)
	) {
		throw new Error(
			`${TEMPLATE_METADATA_FILE} amazonLinuxPackages must be an array of package-name strings or the "playwright-chromium" preset`,
		);
	}

	await installAmazonLinuxPackages(sandbox, amazonLinuxPackages);
}

async function installAmazonLinuxPackages(sandbox: Sandbox, packageNames: string[]): Promise<void> {
	if (packageNames.length === 0) {
		return;
	}

	const packageList = packageNames.join(' ');
	const result = await sandbox.runCommand('bash', [
		'-lc',
		[
			'set -e',
			'if grep -q \'ID="amzn"\' /etc/os-release && command -v dnf >/dev/null; then',
			'  if command -v sudo >/dev/null; then',
			`    sudo dnf install -y ${packageList}`,
			'  else',
			`    dnf install -y ${packageList}`,
			'  fi',
			'fi',
		].join('\n'),
	]);

	if (result.exitCode !== 0) {
		throw new Error(
			`Failed to install template system dependencies: ${result.stderr || result.stdout}`,
		);
	}
}

// Pin every Storybook dependency in the sandbox package.json files (the root
// and any workspace package) to the version currently behind the given npm
// dist-tag, so result snapshots record the exact version each run used. The
// local @storybook/addon-mcp and @storybook/mcp file: builds are always kept
// as-is; EVAL_STORYBOOK_LATEST=1 only switches the Storybook release itself
// to the `latest` tag, to test the current checkout against the last stable
// release.
export async function pinStorybookPackages(
	files: Record<string, string>,
	distTag: 'next' | 'latest',
): Promise<void> {
	for (const filePath of workspacePackageJsonPaths(files)) {
		const packageJson = parseJsonFile(filePath, files[filePath] ?? '', 'fixture');
		if (!isRecord(packageJson)) {
			continue;
		}

		for (const field of ['dependencies', 'devDependencies'] as const) {
			const dependencies = packageJson[field];
			if (!isRecord(dependencies)) {
				continue;
			}

			for (const [name, spec] of Object.entries(dependencies)) {
				if (name !== 'storybook' && !name.startsWith('@storybook/')) {
					continue;
				}
				if (typeof spec === 'string' && spec.startsWith('file:')) {
					continue;
				}
				dependencies[name] = await resolveDistTagVersion(name, distTag);
			}
		}

		files[filePath] = JSON.stringify(packageJson, null, 2).concat('\n');
	}
}

function referencesStartStorybookScript(files: Record<string, string>): boolean {
	return workspacePackageJsonPaths(files).some((filePath) =>
		(files[filePath] ?? '').includes('start-storybook-mcp.mjs'),
	);
}

// The sandbox root package.json plus workspace packages; the injected
// local-packages builds are never rewritten.
function workspacePackageJsonPaths(files: Record<string, string>): string[] {
	return Object.keys(files).filter(
		(filePath) =>
			(filePath === 'package.json' || filePath.endsWith('/package.json')) &&
			!filePath.startsWith('local-packages/') &&
			!filePath.includes('node_modules/'),
	);
}

const distTagVersionCache = new Map<string, string>();

async function resolveDistTagVersion(packageName: string, distTag: string): Promise<string> {
	const cacheKey = `${packageName}@${distTag}`;
	const cached = distTagVersionCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const response = await fetch(
		`https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`,
	);
	if (!response.ok) {
		throw new Error(
			`Failed to resolve dist-tags for ${packageName}: ${response.status} ${response.statusText}`,
		);
	}

	const distTags = (await response.json()) as unknown;
	const version = isRecord(distTags) ? distTags[distTag] : undefined;
	if (typeof version !== 'string') {
		throw new Error(`Package ${packageName} has no "${distTag}" dist-tag`);
	}

	distTagVersionCache.set(cacheKey, version);
	return version;
}

// A workspace package references the injected builds with a file: spec whose
// target is the sandbox-root local-packages directory — `file:./local-packages/…`
// from the root, `file:../../local-packages/…` from a workspace leaf.
function usesLocalStorybookMcpPackages(files: Record<string, string>): boolean {
	return workspacePackageJsonPaths(files).some((filePath) => {
		const packageJson = JSON.parse(files[filePath] ?? '{}') as unknown;

		if (!isRecord(packageJson)) {
			return false;
		}

		return (
			isLocalPackagesSpec(getDependencySpec(packageJson, '@storybook/addon-mcp'), 'addon-mcp') ||
			isLocalPackagesSpec(getDependencySpec(packageJson, '@storybook/mcp'), 'mcp')
		);
	});
}

function isLocalPackagesSpec(spec: string | undefined, packageDir: string): boolean {
	return (
		spec !== undefined && spec.startsWith('file:') && spec.endsWith(`local-packages/${packageDir}`)
	);
}

function getDependencySpec(packageJson: Record<string, unknown>, name: string): string | undefined {
	const dependencies = isRecord(packageJson.dependencies) ? packageJson.dependencies : {};
	const devDependencies = isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {};
	const spec = dependencies[name] ?? devDependencies[name];

	return typeof spec === 'string' ? spec : undefined;
}

async function readLocalStorybookMcpPackages(): Promise<Record<string, string>> {
	const catalog = await readDefaultCatalog();

	return {
		...(await readLocalStorybookMcpPackage(catalog)),
		...(await readLocalStorybookAddonMcpPackage(catalog)),
	};
}

async function readLocalStorybookMcpPackage(catalog: Catalog): Promise<Record<string, string>> {
	const sourceDir = path.join(REPO_ROOT, 'packages', 'mcp');
	const targetDir = path.posix.join('local-packages', 'mcp');
	const files = await readPackageDistFiles(sourceDir, targetDir);

	files[path.posix.join(targetDir, 'package.json')] = await readSandboxPackageJson(sourceDir, {
		catalog,
	});

	return files;
}

async function readLocalStorybookAddonMcpPackage(
	catalog: Catalog,
): Promise<Record<string, string>> {
	const sourceDir = path.join(REPO_ROOT, 'packages', 'addon-mcp');
	const targetDir = path.posix.join('local-packages', 'addon-mcp');
	const files = await readPackageDistFiles(sourceDir, targetDir);

	files[path.posix.join(targetDir, 'preset.js')] = await fs.readFile(
		path.join(sourceDir, 'preset.js'),
		'utf8',
	);
	files[path.posix.join(targetDir, 'package.json')] = await readSandboxPackageJson(sourceDir, {
		catalog,
		dependencyOverrides: {
			'@storybook/mcp': 'file:../mcp',
		},
	});

	return files;
}

async function readSandboxPackageJson(
	sourceDir: string,
	options: { catalog: Catalog; dependencyOverrides?: DependencyOverrides },
): Promise<string> {
	const packageJson = JSON.parse(
		await fs.readFile(path.join(sourceDir, 'package.json'), 'utf8'),
	) as unknown;

	if (!isRecord(packageJson)) {
		throw new Error(`Expected ${path.join(sourceDir, 'package.json')} to contain a JSON object`);
	}

	const sandboxPackageJson = rewritePackageSpecsForNpm(packageJson, options);
	return JSON.stringify(sandboxPackageJson, null, 2).concat('\n');
}

function rewritePackageSpecsForNpm(
	packageJson: Record<string, unknown>,
	options: { catalog: Catalog; dependencyOverrides?: DependencyOverrides },
): Record<string, unknown> {
	const dependencyOverrides = options.dependencyOverrides ?? {};
	const result = JSON.parse(JSON.stringify(packageJson)) as Record<string, unknown>;
	const dependencyFields = [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
		'peerDependencies',
	] as const;

	for (const field of dependencyFields) {
		const dependencies = result[field];
		if (!isRecord(dependencies)) {
			continue;
		}

		for (const [name, spec] of Object.entries(dependencies)) {
			if (typeof spec !== 'string') {
				continue;
			}

			dependencies[name] = rewriteDependencySpec(name, spec, {
				catalog: options.catalog,
				dependencyOverrides,
			});
		}
	}

	return result;
}

function rewriteDependencySpec(
	name: string,
	spec: string,
	options: { catalog: Catalog; dependencyOverrides: DependencyOverrides },
): string {
	const override = options.dependencyOverrides[name];
	if (override !== undefined) {
		return override;
	}

	if (spec === 'catalog:') {
		const catalogSpec = options.catalog[name];
		if (catalogSpec === undefined) {
			throw new Error(`Missing default catalog entry for ${name}`);
		}
		return catalogSpec;
	}

	if (spec.startsWith('catalog:')) {
		throw new Error(`Unsupported catalog dependency for ${name}: ${spec}`);
	}

	if (spec.startsWith('workspace:')) {
		throw new Error(`Missing npm-compatible override for workspace dependency ${name}`);
	}

	return spec;
}

async function readDefaultCatalog(): Promise<Catalog> {
	const workspaceYaml = await fs.readFile(path.join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');
	const catalog: Catalog = {};
	let inDefaultCatalog = false;

	// This intentionally supports only the repo-owned two-space default `catalog:` shape.
	// Named catalogs stay unsupported here and still fail explicitly in `rewriteDependencySpec`.
	for (const line of workspaceYaml.split('\n')) {
		if (line.trim() === 'catalog:') {
			inDefaultCatalog = true;
			continue;
		}

		if (!inDefaultCatalog) {
			continue;
		}

		if (line.length > 0 && !line.startsWith(' ')) {
			break;
		}

		const match = /^\s{2}(.+?):\s*(.+?)\s*$/.exec(line);
		if (!match) {
			continue;
		}
		const [, rawName, rawSpec] = match;
		if (rawName === undefined || rawSpec === undefined) {
			continue;
		}

		catalog[stripYamlQuotes(rawName)] = stripYamlQuotes(rawSpec);
	}

	return catalog;
}

function stripYamlQuotes(value: string): string {
	return value.replace(/^['"]|['"]$/g, '');
}

async function readPackageDistFiles(
	sourceDir: string,
	targetDir: string,
): Promise<Record<string, string>> {
	const distDir = path.join(sourceDir, 'dist');
	const packageName = path.basename(sourceDir);
	try {
		const distStat = await fs.stat(distDir);
		if (!distStat.isDirectory()) {
			throw new Error(`${distDir} exists but is not a directory`);
		}
	} catch {
		throw new Error(
			`Missing build output for ${packageName} at ${distDir}. Run \`pnpm turbo run build\` before running agent-eval.`,
		);
	}

	const files: Record<string, string> = {};
	await collectFiles({ sourceDir, relativeDir: 'dist', targetDir, files });
	return files;
}

async function collectFiles(options: {
	sourceDir: string;
	targetDir: string;
	files: Record<string, string>;
	relativeDir?: string;
	exclude?: (filePath: string) => boolean;
}): Promise<void> {
	const relativeDir = options.relativeDir ?? '';
	const dir = path.join(options.sourceDir, relativeDir);
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const sourceRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
		const sandboxRelativePath = toPosixPath(sourceRelativePath);
		if (options.exclude?.(sandboxRelativePath)) {
			continue;
		}

		const fullPath = path.join(options.sourceDir, sourceRelativePath);

		if (entry.isDirectory()) {
			await collectFiles({ ...options, relativeDir: sourceRelativePath });
			continue;
		}

		if (entry.isFile()) {
			options.files[toSandboxPath(options.targetDir, sandboxRelativePath)] = await fs.readFile(
				fullPath,
				'utf8',
			);
		}
	}
}

export async function writeClaudeMcpConfig(sandbox: Sandbox): Promise<void> {
	await writeClaudeMcpServer(sandbox, STORYBOOK_MCP_SERVER_NAME, {
		type: 'http',
		url: STORYBOOK_MCP_URL,
	});
}

export async function writeCodexMcpConfig(sandbox: Sandbox): Promise<void> {
	const config = `[mcp_servers.${STORYBOOK_MCP_SERVER_NAME}]
url = "${STORYBOOK_MCP_URL}"
default_tools_approval_mode = "auto"
startup_timeout_sec = 30
tool_timeout_sec = 120
`;

	await appendCodexConfig(sandbox, config);
}

/**
 * Ship the Codex in-app-browser stand-in: a `node_repl` MCP server (the real
 * one is a native binary bundled only with the Codex desktop app), the
 * browser runtime mock it imports, and the `control-in-app-browser` skill
 * that teaches Codex the same bootstrap flow the app uses.
 */
export async function writeCodexInAppBrowserMock(sandbox: Sandbox): Promise<void> {
	await sandbox.writeFiles({
		[NODE_REPL_MOCK_SANDBOX_PATH]: await fs.readFile(NODE_REPL_MOCK_SOURCE_PATH, 'utf8'),
		[CODEX_BROWSER_MOCK_SANDBOX_PATH]: await fs.readFile(CODEX_BROWSER_MOCK_SOURCE_PATH, 'utf8'),
		[CODEX_BROWSER_API_SANDBOX_PATH]: await fs.readFile(CODEX_BROWSER_API_SOURCE_PATH, 'utf8'),
		[CODEX_BROWSER_SKILL_SANDBOX_PATH]: await fs.readFile(CODEX_BROWSER_SKILL_SOURCE_PATH, 'utf8'),
	});

	const config = `[mcp_servers.node_repl]
command = "node"
args = ["${NODE_REPL_MOCK_SANDBOX_PATH}"]
default_tools_approval_mode = "auto"
startup_timeout_sec = 30
tool_timeout_sec = 180
`;

	await appendCodexConfig(sandbox, config);
}

async function appendCodexConfig(sandbox: Sandbox, section: string): Promise<void> {
	let existing = '';
	try {
		existing = await sandbox.readFile(CODEX_CONFIG_PATH);
	} catch {
		// No config yet.
	}

	if (existing.includes(section.split('\n', 1)[0] ?? section)) {
		return;
	}

	const config = existing.length > 0 ? `${existing.trimEnd()}\n\n${section}` : section;
	await sandbox.writeFiles({
		[CODEX_CONFIG_PATH]: config,
	});
}

export async function writeClaudePluginSkills(sandbox: Sandbox): Promise<void> {
	await writePluginSkills(sandbox, CLAUDE_PLUGIN_SKILLS_DIR, path.posix.join('.claude', 'skills'));
}

export async function writeCodexPluginSkills(sandbox: Sandbox): Promise<void> {
	await writePluginSkills(sandbox, CODEX_PLUGIN_SKILLS_DIR, path.posix.join('.agents', 'skills'));
}

export async function writeClaudePreviewBrowserMock(sandbox: Sandbox): Promise<void> {
	await sandbox.writeFiles({
		[PREVIEW_BROWSER_MOCK_SANDBOX_PATH]: await fs.readFile(
			PREVIEW_BROWSER_MOCK_SOURCE_PATH,
			'utf8',
		),
	});
	await writeClaudeMcpServer(sandbox, PREVIEW_BROWSER_MCP_SERVER_NAME, {
		command: 'node',
		args: [PREVIEW_BROWSER_MOCK_SANDBOX_PATH],
	});
}

async function writePluginSkills(
	sandbox: Sandbox,
	sourceDir: string,
	targetDir: string,
): Promise<void> {
	const files: Record<string, string> = {};
	await collectFiles({ sourceDir, targetDir, files });
	await sandbox.writeFiles(files);
}

async function writeClaudeMcpServer(
	sandbox: Sandbox,
	serverName: string,
	serverConfig: Record<string, unknown>,
): Promise<void> {
	const config = await readClaudeMcpConfig(sandbox);
	const mcpServers = isRecord(config.mcpServers) ? config.mcpServers : {};

	await sandbox.writeFiles({
		[CLAUDE_MCP_CONFIG_PATH]: JSON.stringify(
			{
				...config,
				mcpServers: {
					...mcpServers,
					[serverName]: serverConfig,
				},
			},
			null,
			2,
		).concat('\n'),
	});
}

async function readClaudeMcpConfig(sandbox: Sandbox): Promise<Record<string, unknown>> {
	let rawConfig: string;
	try {
		rawConfig = await sandbox.readFile(CLAUDE_MCP_CONFIG_PATH);
	} catch {
		return {};
	}

	const config = JSON.parse(rawConfig) as unknown;
	if (!isRecord(config)) {
		throw new Error(`${CLAUDE_MCP_CONFIG_PATH} must contain a JSON object`);
	}
	return config;
}

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join(path.posix.sep);
}

function toSandboxPath(targetDir: string, filePath: string): string {
	return targetDir.length > 0 ? path.posix.join(toPosixPath(targetDir), filePath) : filePath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error;
}
