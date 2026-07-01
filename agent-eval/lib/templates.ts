import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';

type FixturePackageJson = {
	evals?: {
		template?: unknown;
	};
};

type EvalAgent = 'claude-code' | 'codex';
type EvalIntegration = 'mcp' | 'plugin';
type Catalog = Record<string, string>;
type DependencyOverrides = Record<string, string>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(AGENT_EVAL_ROOT, '..');
const TEMPLATES_DIR = path.join(AGENT_EVAL_ROOT, 'templates');
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
const TRANSCRIPT_HELPER_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'test-utils.ts');
const TRANSCRIPT_HELPER_SANDBOX_PATH = path.posix.join('__agent_eval__', 'test-utils.ts');
const AGENT_CONTEXT_SANDBOX_PATH = path.posix.join('__agent_eval__', 'agent.json');
const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const LOCAL_STORYBOOK_ADDON_MCP_SPEC = 'file:./local-packages/addon-mcp';
const LOCAL_STORYBOOK_MCP_SPEC = 'file:./local-packages/mcp';
const STORYBOOK_MCP_SERVER_NAME = 'storybook-dev-mcp';
const STORYBOOK_MCP_URL = 'http://127.0.0.1:6006/mcp';
const PREVIEW_BROWSER_MCP_SERVER_NAME = 'preview-browser';
const PLAYWRIGHT_AMAZON_LINUX_PACKAGES = [
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
	let files = await readTemplateFiles(templateDir);

	if (Object.keys(files).length === 0) {
		throw new Error(`Template "${templateName}" does not contain any files`);
	}

	files = mergeTemplateAndFixtureFiles(files, fixtureFiles);

	if (usesLocalStorybookMcpPackages(files)) {
		Object.assign(files, await readLocalStorybookMcpPackages());
	}

	if (templateName === 'reshaped-storybook') {
		const packageList = PLAYWRIGHT_AMAZON_LINUX_PACKAGES.join(' ');
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
				`Failed to install Playwright system dependencies: ${result.stderr || result.stdout}`,
			);
		}
	}

	await sandbox.writeFiles(files);
}

async function writeEvalSupportFiles(
	sandbox: Sandbox,
	options: { agent: EvalAgent; integration: EvalIntegration },
): Promise<void> {
	await sandbox.writeFiles({
		[TRANSCRIPT_HELPER_SANDBOX_PATH]: await fs.readFile(TRANSCRIPT_HELPER_SOURCE_PATH, 'utf8'),
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
	await collectTemplateFiles(templateDir, '', files);
	return files;
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

function usesLocalStorybookAddonMcp(files: Record<string, string>): boolean {
	const packageJson = JSON.parse(files['package.json'] ?? '{}') as unknown;

	if (!isRecord(packageJson)) {
		return false;
	}

	return getDependencySpec(packageJson, '@storybook/addon-mcp') === LOCAL_STORYBOOK_ADDON_MCP_SPEC;
}

function usesLocalStorybookMcpPackage(files: Record<string, string>): boolean {
	const packageJson = JSON.parse(files['package.json'] ?? '{}') as unknown;

	if (!isRecord(packageJson)) {
		return false;
	}

	return getDependencySpec(packageJson, '@storybook/mcp') === LOCAL_STORYBOOK_MCP_SPEC;
}

function usesLocalStorybookMcpPackages(files: Record<string, string>): boolean {
	return usesLocalStorybookAddonMcp(files) || usesLocalStorybookMcpPackage(files);
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
	await collectPackageFiles(sourceDir, 'dist', targetDir, files);
	return files;
}

async function collectPackageFiles(
	sourceDir: string,
	relativeDir: string,
	targetDir: string,
	files: Record<string, string>,
): Promise<void> {
	const dir = path.join(sourceDir, relativeDir);
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const sourceRelativePath = path.join(relativeDir, entry.name);
		const sandboxRelativePath = path.posix.join(toPosixPath(relativeDir), entry.name);
		const fullPath = path.join(sourceDir, sourceRelativePath);

		if (entry.isDirectory()) {
			await collectPackageFiles(sourceDir, sourceRelativePath, targetDir, files);
			continue;
		}

		if (entry.isFile()) {
			files[path.posix.join(toPosixPath(targetDir), sandboxRelativePath)] = await fs.readFile(
				fullPath,
				'utf8',
			);
		}
	}
}

async function collectTemplateFiles(
	baseDir: string,
	relativeDir: string,
	files: Record<string, string>,
): Promise<void> {
	const dir = path.join(baseDir, relativeDir);
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const sourceRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
		const sandboxRelativePath = relativeDir
			? path.posix.join(toPosixPath(relativeDir), entry.name)
			: entry.name;
		const fullPath = path.join(baseDir, sourceRelativePath);

		if (entry.isDirectory()) {
			await collectTemplateFiles(baseDir, sourceRelativePath, files);
			continue;
		}

		if (entry.isFile()) {
			files[sandboxRelativePath] = await fs.readFile(fullPath, 'utf8');
		}
	}
}

export async function writeClaudeMcpConfig(sandbox: Sandbox): Promise<void> {
	await sandbox.writeFiles({
		'.mcp.json': JSON.stringify(
			{
				mcpServers: {
					[STORYBOOK_MCP_SERVER_NAME]: {
						type: 'http',
						url: STORYBOOK_MCP_URL,
					},
				},
			},
			null,
			2,
		).concat('\n'),
	});
}

export async function writeCodexMcpConfig(sandbox: Sandbox): Promise<void> {
	const config = `[mcp_servers.${STORYBOOK_MCP_SERVER_NAME}]
url = "${STORYBOOK_MCP_URL}"
default_tools_approval_mode = "auto"
startup_timeout_sec = 30
tool_timeout_sec = 120
`;

	await sandbox.writeFiles({
		'.codex/config.toml': config,
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
		'.mcp.json': JSON.stringify(
			{
				mcpServers: {
					[PREVIEW_BROWSER_MCP_SERVER_NAME]: {
						command: 'node',
						args: [PREVIEW_BROWSER_MOCK_SANDBOX_PATH],
					},
				},
			},
			null,
			2,
		).concat('\n'),
	});
}

async function writePluginSkills(
	sandbox: Sandbox,
	sourceDir: string,
	targetDir: string,
): Promise<void> {
	const files: Record<string, string> = {};
	await collectPackageFiles(sourceDir, '', targetDir, files);
	await sandbox.writeFiles(files);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join(path.posix.sep);
}
