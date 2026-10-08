import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { Sandbox } from '@vercel/agent-eval';

import { isRecord } from './utils/type.ts';

type FixturePackageJson = {
  evals?: {
    template?: unknown;
    checkoutRegistry?: unknown;
  };
};

// A published package of this monorepo. `dependencies` lists the monorepo packages npm installs
// along with it.
export type WorkspacePackage = {
  name: string;
  dir: string;
  project: string;
  dependencies: string[];
};
export type StorybookWorkspace = Map<string, WorkspacePackage>;

export type EvalAgent = 'claude-code' | 'codex';
// 'none' = bare sandbox: no Storybook tooling flavor recorded in the agent
// context. Used by control cases that must provide zero agent support.
export type EvalIntegration = 'mcp' | 'plugin' | 'none';
type TemplateMetadata = {
  amazonLinuxPackages?: unknown;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(AGENT_EVAL_ROOT, '..');
const TEMPLATES_DIR = path.join(AGENT_EVAL_ROOT, 'templates');
const EVALS_DIR = path.join(AGENT_EVAL_ROOT, 'evals');
const TEMPLATE_METADATA_FILE = 'eval-template.json';
const NODE_REPL_MOCK_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'mcp', 'node-repl-mock.mjs');
const NODE_REPL_MOCK_SANDBOX_PATH = path.posix.join('.agent-eval', 'mcp', 'node-repl-mock.mjs');
const CODEX_BROWSER_MOCK_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'codex-browser-client-mock.mjs'
);
const CODEX_BROWSER_MOCK_SANDBOX_PATH = path.posix.join(
  '.agent-eval',
  'mcp',
  'codex-browser-client-mock.mjs'
);
const CODEX_BROWSER_API_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'codex-browser-api.json'
);
const CODEX_BROWSER_API_SANDBOX_PATH = path.posix.join(
  '.agent-eval',
  'mcp',
  'codex-browser-api.json'
);
const CODEX_BROWSER_SKILL_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'codex-browser-skill.md'
);
const CODEX_AGENTS_MD_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'mcp', 'codex-agents.md');
const CODEX_BROWSER_SKILL_SANDBOX_PATH = path.posix.join(
  '.agents',
  'skills',
  'control-in-app-browser',
  'SKILL.md'
);
const CLAUDE_BROWSER_MOCK_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'claude-browser-mock.mjs'
);
const CLAUDE_BROWSER_MOCK_SANDBOX_PATH = path.posix.join(
  '.agent-eval',
  'mcp',
  'claude-browser-mock.mjs'
);
const CLAUDE_BROWSER_PROMPT_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'claude-browser-prompt.md'
);
const CLAUDE_BROWSER_PROMPT_SANDBOX_PATH = 'CLAUDE.md';
const START_STORYBOOK_SCRIPT_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'mcp',
  'start-storybook-mcp.mjs'
);
const START_STORYBOOK_SCRIPT_SANDBOX_PATH = path.posix.join('scripts', 'start-storybook-mcp.mjs');
const TRANSCRIPT_HELPER_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'test-utils.ts');
const TRANSCRIPT_HELPER_SANDBOX_PATH = path.posix.join('__agent_eval__', 'test-utils.ts');
// The sandbox copy has to carry test-utils.ts's whole import graph, since these
// files are written verbatim and resolve relatively once there: test-utils.ts
// imports ./shell-parse.ts and ./utils/type.ts, and shell-parse.ts imports
// ./utils/type.ts too. Missing one fails every eval at import time, and only in
// the sandbox — so add the file here whenever that graph grows.
const SHELL_PARSE_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'shell-parse.ts');
const SHELL_PARSE_SANDBOX_PATH = path.posix.join('__agent_eval__', 'shell-parse.ts');
const TYPE_UTIL_SOURCE_PATH = path.join(AGENT_EVAL_ROOT, 'lib', 'utils', 'type.ts');
const TYPE_UTIL_SANDBOX_PATH = path.posix.join('__agent_eval__', 'utils', 'type.ts');
const AGENT_CONTEXT_SANDBOX_PATH = path.posix.join('__agent_eval__', 'agent.json');
const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const CHECKOUT_PACKAGES_DIR = 'local-packages';
// Read by start-storybook-mcp.mjs to fail the install when npm took one of these from the registry.
const CHECKOUT_PACKAGE_NAMES_SANDBOX_PATH = path.posix.join(CHECKOUT_PACKAGES_DIR, 'packages.json');
const WORKSPACE_SPEC = 'workspace:*';
const CHECKOUT_REGISTRY_PORT = 4873;
const CHECKOUT_REGISTRY_URL = `http://127.0.0.1:${CHECKOUT_REGISTRY_PORT}/`;
const CHECKOUT_REGISTRY_SERVER_SOURCE_PATH = path.join(
  AGENT_EVAL_ROOT,
  'lib',
  'checkout-registry-server.mjs'
);
// Outside the project, so the agent never sees the tarballs and the project copy stays small.
const CHECKOUT_REGISTRY_SANDBOX_DIR = '/tmp/agent-eval-registry';
const CHECKOUT_REGISTRY_UPLOAD_DIR = '.agent-eval-registry';
// Read by expectStorybookInstalledFromCheckout in an EVAL.ts.
const CHECKOUT_REGISTRY_INFO_SANDBOX_PATH = path.posix.join(
  '__agent_eval__',
  'checkout-registry.json'
);
// The CLIs `create storybook` and `storybook upgrade` run, and every package they can install or
// upgrade in a React + Vite project: the framework and the core addons. `storybook upgrade` bumps
// every Storybook package the project has, such as the MCP addon a 10.x upgrade adds. The
// registry also serves the monorepo packages these depend on.
const CHECKOUT_REGISTRY_PACKAGES = [
  'create-storybook',
  '@storybook/cli',
  'storybook',
  '@storybook/react-vite',
  '@storybook/addon-a11y',
  '@storybook/addon-docs',
  '@storybook/addon-links',
  '@storybook/addon-mcp',
  '@storybook/addon-onboarding',
  '@storybook/addon-themes',
  '@storybook/addon-vitest',
  'eslint-plugin-storybook',
];
const execFileAsync = promisify(execFile);
const STORYBOOK_MAIN_PATTERN = /(^|\/)\.storybook\/main\.ts$/;
const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';
// Captures the entries of the `addons` list, without the trailing comma.
const STORYBOOK_ADDONS_PATTERN = /addons: \[([^\]]*?),?\s*\]/;
const STORYBOOK_MCP_SERVER_NAME = 'storybook-dev-mcp';
const CLAUDE_BROWSER_MCP_SERVER_NAME = 'Browser';
const STORYBOOK_MCP_URL = 'http://127.0.0.1:6006/mcp';
const CLAUDE_MCP_CONFIG_PATH = '.mcp.json';
const CODEX_CONFIG_PATH = '.codex/config.toml';
const CLAUDE_PLUGIN_SKILLS_DIR = path.join(REPO_ROOT, 'code', 'lib', 'claude-plugin', 'skills');
const CODEX_PLUGIN_SKILLS_DIR = path.join(
  REPO_ROOT,
  'code',
  'lib',
  'codex-plugin',
  'plugins',
  'storybook',
  'skills'
);

export async function setupSandbox(
  sandbox: Sandbox,
  options: { agent: EvalAgent; integration: EvalIntegration }
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
      'Expected package.json evals.template to contain only lowercase letters, numbers, and hyphens'
    );
  }

  const templateDir = path.join(TEMPLATES_DIR, templateName);
  const templateMetadata = await readTemplateMetadata(templateDir);
  let files = await readTemplateFiles(templateDir);

  if (Object.keys(files).length === 0) {
    throw new Error(`Template "${templateName}" does not contain any files`);
  }

  files = mergeTemplateAndFixtureFiles(files, fixtureFiles);

  if (options.integration === 'mcp') {
    addMcpAddon(files);
  }

  const workspace = await readStorybookWorkspace();
  let packedCheckout = false;
  if (process.env.EVAL_STORYBOOK_LATEST === '1') {
    await pointStorybookAtLatest(files, workspace);
  } else {
    const packages = await pointStorybookAtCheckout(files, workspace);
    if (packages.length > 0) {
      Object.assign(files, await packCheckoutPackages(packages));
      files[CHECKOUT_PACKAGE_NAMES_SANDBOX_PATH] = JSON.stringify(packages.map((pkg) => pkg.name));
      // Keeps the megabytes of tarballs out of the run's captured changes and saved results.
      const gitignore = files['.gitignore'] ?? '';
      files['.gitignore'] =
        `${gitignore}${gitignore === '' || gitignore.endsWith('\n') ? '' : '\n'}${CHECKOUT_PACKAGES_DIR}/\n`;
      packedCheckout = true;
    }
  }

  // The Storybook-starting postinstall script is maintained once in lib/mcp
  // and injected wherever a package.json references it, so the templates and
  // fixtures cannot drift apart.
  if (referencesStartStorybookScript(files)) {
    files[START_STORYBOOK_SCRIPT_SANDBOX_PATH] = await fs.readFile(
      START_STORYBOOK_SCRIPT_SOURCE_PATH,
      'utf8'
    );
  }

  await setupTemplateSandbox(sandbox, templateMetadata);
  await sandbox.writeFiles(files);

  if (packedCheckout) {
    await decodeCheckoutPackages(sandbox);
  }

  if (packageJson.evals?.checkoutRegistry === true && process.env.EVAL_STORYBOOK_LATEST !== '1') {
    await startCheckoutRegistry(sandbox, workspace);
  }
}

// The harness commits the fixture before `setup` runs, so everything setup writes afterwards (the
// template, skills, mocks, MCP config) would show up as the agent's own change: in `git status`, in
// `storybook tools stories changed`, and in the files saved with the run. Call this last in `setup`.
export async function commitSandboxBaseline(sandbox: Sandbox): Promise<void> {
  const result = await sandbox.runCommand('bash', [
    '-c',
    'git add -A && git commit -q --allow-empty -m "Set up the project"',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to commit the sandbox baseline: ${result.stderr || result.stdout}`);
  }
}

async function writeEvalSupportFiles(
  sandbox: Sandbox,
  options: { agent: EvalAgent; integration: EvalIntegration }
): Promise<void> {
  await sandbox.writeFiles({
    [TRANSCRIPT_HELPER_SANDBOX_PATH]: await fs.readFile(TRANSCRIPT_HELPER_SOURCE_PATH, 'utf8'),
    [SHELL_PARSE_SANDBOX_PATH]: await fs.readFile(SHELL_PARSE_SOURCE_PATH, 'utf8'),
    [TYPE_UTIL_SANDBOX_PATH]: await fs.readFile(TYPE_UTIL_SOURCE_PATH, 'utf8'),
    [AGENT_CONTEXT_SANDBOX_PATH]: JSON.stringify(
      { agent: options.agent, integration: options.integration },
      null,
      2
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
  fixtureFiles: Record<string, string>
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
      parseJsonFile(filePath, fixtureContent, 'fixture')
    );
    files[filePath] = JSON.stringify(merged, null, 2).concat('\n');
  }

  return files;
}

// Only the MCP experiments get the addon: the plugin skills have to work in a project without it.
export function addMcpAddon(files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    if (!STORYBOOK_MAIN_PATTERN.test(filePath)) {
      continue;
    }

    if (!STORYBOOK_ADDONS_PATTERN.test(content)) {
      throw new Error(`Cannot add ${STORYBOOK_MCP_ADDON}: ${filePath} has no "addons: [...]" list`);
    }
    files[filePath] = content.replace(
      STORYBOOK_ADDONS_PATTERN,
      (_, addons: string) =>
        `addons: [${[addons.trim(), `'${STORYBOOK_MCP_ADDON}'`].filter(Boolean).join(', ')}]`
    );

    const manifestPath = path.posix.join(path.posix.dirname(filePath), '..', 'package.json');
    const packageJson = parseJsonFile(manifestPath, files[manifestPath] ?? '', 'fixture');
    if (!isRecord(packageJson)) {
      throw new Error(`Expected ${manifestPath} to contain a JSON object`);
    }
    packageJson.devDependencies = {
      ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
      [STORYBOOK_MCP_ADDON]: WORKSPACE_SPEC,
    };
    files[manifestPath] = JSON.stringify(packageJson, null, 2).concat('\n');
  }
}

function parseJsonFile(filePath: string, content: string, source: 'fixture' | 'template'): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse ${source} JSON file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
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
  templateMetadata: TemplateMetadata
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
      (packageName) => typeof packageName === 'string' && /^[a-zA-Z0-9_.+-]+$/.test(packageName)
    )
  ) {
    throw new Error(
      `${TEMPLATE_METADATA_FILE} amazonLinuxPackages must be an array of package-name strings or the "playwright-chromium" preset`
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
      `Failed to install template system dependencies: ${result.stderr || result.stdout}`
    );
  }
}

// Point every `workspace:*` dependency in the sandbox manifests at a `yarn pack` tarball of this
// checkout, and force the packed packages onto their tarballs through the root `overrides`,
// including the ones only reached through another monorepo package. Returns the packages to pack.
export async function pointStorybookAtCheckout(
  files: Record<string, string>,
  workspace: StorybookWorkspace
): Promise<WorkspacePackage[]> {
  // npm resolves a `file:` override relative to the workspace package whose dependency it
  // replaces, so these keep only their own spec.
  const directInWorkspacePackage = new Set<string>();
  const direct = await replaceWorkspaceSpecs(files, workspace, (pkg, manifestDir) => {
    if (manifestDir !== '.') {
      directInWorkspacePackage.add(pkg.name);
    }
    return checkoutPackageSpec(manifestDir, pkg.name);
  });

  const packages = new Map(direct.map((pkg) => [pkg.name, pkg]));
  for (const pkg of packages.values()) {
    for (const name of pkg.dependencies) {
      const dependency = workspace.get(name);
      if (dependency) {
        packages.set(name, dependency);
      }
    }
  }

  const overridden = [...packages.keys()].filter((name) => !directInWorkspacePackage.has(name));
  if (overridden.length > 0) {
    const rootPackageJson = parseJsonFile('package.json', files['package.json'] ?? '', 'fixture');
    if (!isRecord(rootPackageJson)) {
      throw new Error('Expected the sandbox package.json to contain a JSON object');
    }
    rootPackageJson.overrides = {
      ...(isRecord(rootPackageJson.overrides) ? rootPackageJson.overrides : {}),
      ...Object.fromEntries(overridden.map((name) => [name, checkoutPackageSpec('.', name)])),
    };
    files['package.json'] = JSON.stringify(rootPackageJson, null, 2).concat('\n');
  }

  return [...packages.values()];
}

async function pointStorybookAtLatest(
  files: Record<string, string>,
  workspace: StorybookWorkspace
): Promise<void> {
  await replaceWorkspaceSpecs(files, workspace, (pkg) => resolveDistTagVersion(pkg.name, 'latest'));
}

// Rewrites each `workspace:*` dependency in the sandbox root and workspace manifests with
// `resolve`, and returns the monorepo packages it rewrote.
async function replaceWorkspaceSpecs(
  files: Record<string, string>,
  workspace: StorybookWorkspace,
  resolve: (pkg: WorkspacePackage, manifestDir: string) => string | Promise<string>
): Promise<WorkspacePackage[]> {
  const replaced: WorkspacePackage[] = [];

  for (const filePath of workspacePackageJsonPaths(files)) {
    const packageJson = parseJsonFile(filePath, files[filePath] ?? '', 'fixture');
    if (!isRecord(packageJson)) {
      continue;
    }

    let changed = false;
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const dependencies = packageJson[field];
      if (!isRecord(dependencies)) {
        continue;
      }

      for (const [name, spec] of Object.entries(dependencies)) {
        if (typeof spec !== 'string' || !spec.startsWith('workspace:')) {
          continue;
        }
        if (spec !== WORKSPACE_SPEC) {
          throw new Error(`${filePath} depends on ${name}@${spec}; use ${WORKSPACE_SPEC}`);
        }
        const pkg = workspace.get(name);
        if (!pkg) {
          throw new Error(
            `${filePath} depends on ${name}@${WORKSPACE_SPEC}, but ${name} is not a published package of this monorepo`
          );
        }
        dependencies[name] = await resolve(pkg, path.posix.dirname(filePath));
        replaced.push(pkg);
        changed = true;
      }
    }

    // Leave files without Storybook deps byte-identical to their source, so
    // sandbox snapshots don't pick up reformatting noise.
    if (changed) {
      files[filePath] = JSON.stringify(packageJson, null, 2).concat('\n');
    }
  }

  return replaced;
}

function checkoutPackageSpec(manifestDir: string, packageName: string): string {
  return `file:${path.posix.relative(manifestDir, checkoutTarballPath(packageName))}`;
}

function checkoutTarballPath(packageName: string): string {
  return path.posix.join(
    CHECKOUT_PACKAGES_DIR,
    `${packageName.replace(/^@/, '').replace('/', '-')}.tgz`
  );
}

let storybookWorkspace: Promise<StorybookWorkspace> | undefined;

export function readStorybookWorkspace(): Promise<StorybookWorkspace> {
  storybookWorkspace ??= (async () => {
    const { stdout } = await execYarn(['workspaces', 'list', '--json'], { cwd: REPO_ROOT });
    const manifests = await Promise.all(
      stdout
        .trim()
        .split('\n')
        .map(async (line) => {
          const { location } = JSON.parse(line) as { location: string };
          const manifest = JSON.parse(
            await fs.readFile(path.join(REPO_ROOT, location, 'package.json'), 'utf8')
          ) as {
            name: string;
            private?: boolean;
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
            peerDependenciesMeta?: Record<string, { optional?: boolean }>;
          };
          return { location, manifest };
        })
    );
    const published = manifests.filter(({ manifest }) => !manifest.private);
    const names = new Set(published.map(({ manifest }) => manifest.name));

    const packages = await Promise.all(
      published.map(async ({ location, manifest }): Promise<WorkspacePackage> => {
        const project = JSON.parse(
          await fs.readFile(path.join(REPO_ROOT, location, 'project.json'), 'utf8')
        ) as { name: string };
        return {
          name: manifest.name,
          dir: location,
          project: project.name,
          dependencies: [
            ...Object.keys(manifest.dependencies ?? {}),
            // npm installs required peers too, so one left out here would come from the registry.
            ...Object.keys(manifest.peerDependencies ?? {}).filter(
              (name) => !manifest.peerDependenciesMeta?.[name]?.optional
            ),
          ].filter((name) => names.has(name)),
        };
      })
    );
    return new Map(packages.map((pkg) => [pkg.name, pkg]));
  })();
  return storybookWorkspace;
}

const packedTarballs = new Map<string, string>();
let packQueue: Promise<unknown> = Promise.resolve();

// Compiles and packs each package once per process. Sandbox setups run concurrently, so the runs
// are chained: a compile for one sandbox must not rewrite a `dist` another one is still packing.
async function packCheckoutPackages(packages: WorkspacePackage[]): Promise<Record<string, string>> {
  if (packages.every((pkg) => packedTarballs.has(pkg.name))) {
    return readPackedTarballs(packages);
  }

  const run = packQueue.then(async () => {
    const unpacked = packages.filter((pkg) => !packedTarballs.has(pkg.name));
    if (unpacked.length > 0) {
      await compileCheckoutPackages(unpacked);
    }
    await Promise.all(
      unpacked.map(async (pkg) => packedTarballs.set(pkg.name, await packCheckoutPackage(pkg)))
    );
    return readPackedTarballs(packages);
  });
  packQueue = run.catch(() => undefined);
  return run;
}

function readPackedTarballs(packages: WorkspacePackage[]): Record<string, string> {
  const names = new Set(packages.map((pkg) => pkg.name));
  return Object.fromEntries(
    [...packedTarballs]
      .filter(([name]) => names.has(name))
      .map(([name, tarball]) => [`${checkoutTarballPath(name)}.base64`, tarball])
  );
}

// Every monorepo package a template or fixture installs from the checkout, so CI can compile them
// before the evals start: sandbox setup runs inside each eval's timeout.
export async function readTemplateCheckoutPackages(): Promise<WorkspacePackage[]> {
  const workspace = await readStorybookWorkspace();
  const packages = new Map<string, WorkspacePackage>();
  // No manifest lists the addon: setup adds it for the MCP experiments.
  const mcpAddon = workspace.get(STORYBOOK_MCP_ADDON);
  if (mcpAddon) {
    packages.set(mcpAddon.name, mcpAddon);
  }
  for (const sourceDir of [TEMPLATES_DIR, EVALS_DIR]) {
    for await (const manifestPath of fs.glob('**/package.json', {
      cwd: sourceDir,
      exclude: (name) => name === 'node_modules',
    })) {
      const content = await fs.readFile(path.join(sourceDir, manifestPath), 'utf8');
      const manifestPackages = await pointStorybookAtCheckout(
        { 'package.json': content },
        workspace
      );
      const evals = (JSON.parse(content) as FixturePackageJson).evals;
      if (evals?.checkoutRegistry === true) {
        manifestPackages.push(...checkoutRegistryPackages(workspace));
      }
      for (const pkg of manifestPackages) {
        packages.set(pkg.name, pkg);
      }
    }
  }
  return [...packages.values()];
}

export function checkoutRegistryPackages(workspace: StorybookWorkspace): WorkspacePackage[] {
  const packages = new Map<string, WorkspacePackage>();
  const add = (name: string) => {
    const pkg = workspace.get(name);
    if (!pkg) {
      throw new Error(`${name} is not a published package of this monorepo`);
    }
    if (!packages.has(name)) {
      packages.set(name, pkg);
      pkg.dependencies.forEach(add);
    }
  };
  CHECKOUT_REGISTRY_PACKAGES.forEach(add);
  return [...packages.values()];
}

// For evals whose agent installs Storybook itself (`evals.checkoutRegistry` in the fixture), so
// `npm create storybook@next` and `npx storybook@next upgrade` install this checkout instead of the
// published prerelease. The registry publishes the checkout under `next`, keeps `latest` on the
// published release, and sends every other request on to npm.
async function startCheckoutRegistry(
  sandbox: Sandbox,
  workspace: StorybookWorkspace
): Promise<void> {
  const packages = checkoutRegistryPackages(workspace);
  const tarballs = await packCheckoutPackages(packages);
  // Every published package of the monorepo carries the version of code/package.json.
  const { version } = JSON.parse(
    await fs.readFile(path.join(REPO_ROOT, 'code', 'package.json'), 'utf8')
  ) as { version: string };

  await sandbox.writeFiles({
    ...Object.fromEntries(
      Object.entries(tarballs).map(([tarballPath, tarball]) => [
        path.posix.join(CHECKOUT_REGISTRY_UPLOAD_DIR, path.posix.basename(tarballPath)),
        tarball,
      ])
    ),
    [path.posix.join(CHECKOUT_REGISTRY_UPLOAD_DIR, 'registry.json')]: JSON.stringify({
      version,
      tarballs: Object.fromEntries(
        packages.map((pkg) => [pkg.name, path.posix.basename(checkoutTarballPath(pkg.name))])
      ),
      workspacePackages: [...workspace.keys()],
    }),
    [path.posix.join(CHECKOUT_REGISTRY_UPLOAD_DIR, 'server.mjs')]: await fs.readFile(
      CHECKOUT_REGISTRY_SERVER_SOURCE_PATH,
      'utf8'
    ),
    [CHECKOUT_REGISTRY_INFO_SANDBOX_PATH]: JSON.stringify({ url: CHECKOUT_REGISTRY_URL, version }),
  });

  const ping = `curl -sf ${CHECKOUT_REGISTRY_URL}-/ping > /dev/null`;
  const result = await sandbox.runCommand('bash', [
    '-c',
    [
      'set -e',
      `rm -rf ${CHECKOUT_REGISTRY_SANDBOX_DIR} && mkdir -p ${CHECKOUT_REGISTRY_SANDBOX_DIR}`,
      `cd ${CHECKOUT_REGISTRY_UPLOAD_DIR}`,
      `for f in *.base64; do base64 -d "$f" > "${CHECKOUT_REGISTRY_SANDBOX_DIR}/\${f%.base64}"; done`,
      `mv registry.json server.mjs ${CHECKOUT_REGISTRY_SANDBOX_DIR}/`,
      `cd .. && rm -rf ${CHECKOUT_REGISTRY_UPLOAD_DIR}`,
      `setsid node ${CHECKOUT_REGISTRY_SANDBOX_DIR}/server.mjs ${CHECKOUT_REGISTRY_SANDBOX_DIR} ${CHECKOUT_REGISTRY_PORT} > ${CHECKOUT_REGISTRY_SANDBOX_DIR}/server.log 2>&1 < /dev/null &`,
      `for i in $(seq 1 100); do ${ping} && break; sleep 0.1; done`,
      `${ping} || { cat ${CHECKOUT_REGISTRY_SANDBOX_DIR}/server.log; exit 1; }`,
      // User-level, so it applies wherever the agent runs npm and stays out of the project.
      `npm config set registry ${CHECKOUT_REGISTRY_URL} --location=user`,
    ].join('\n'),
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to start the checkout registry: ${result.stderr || result.stdout}`);
  }
}

export async function compileCheckoutPackages(packages: WorkspacePackage[]): Promise<void> {
  const projects = packages.map((pkg) => pkg.project).join(',');
  try {
    // Only the production build emits the type declarations a published package ships.
    await execYarn(
      ['nx', 'run-many', '-t', 'compile', '-c', 'production', '--projects', projects],
      {
        cwd: REPO_ROOT,
        maxBuffer: 64 * 1024 * 1024,
      }
    );
  } catch (error) {
    const output = isRecord(error) ? `${error.stdout ?? ''}${error.stderr ?? ''}` : '';
    throw new Error(
      `Failed to compile ${projects}:\n${output.trimEnd().split('\n').slice(-40).join('\n')}`,
      {
        cause: error,
      }
    );
  }
}

// `yarn pack` applies the package's `files` list and rewrites its `workspace:` ranges, exactly
// like a publish. The sandbox only takes text files and core ships binary assets, so the tarball
// travels base64-encoded.
async function packCheckoutPackage(pkg: WorkspacePackage): Promise<string> {
  const packDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-eval-packages-'));
  try {
    const tarballPath = path.join(packDir, path.posix.basename(checkoutTarballPath(pkg.name)));
    await execYarn(['pack', '--out', tarballPath], {
      cwd: path.join(REPO_ROOT, pkg.dir),
    });
    return (await fs.readFile(tarballPath)).toString('base64');
  } finally {
    await fs.rm(packDir, { recursive: true, force: true });
  }
}

// Windows only finds `yarn.cmd` through a shell, which then needs paths with spaces quoted.
function execYarn(args: string[], options: { cwd: string; maxBuffer?: number }) {
  const isWindows = process.platform === 'win32';
  return execFileAsync(
    'yarn',
    isWindows ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)) : args,
    { ...options, shell: isWindows }
  );
}

async function decodeCheckoutPackages(sandbox: Sandbox): Promise<void> {
  const result = await sandbox.runCommand('bash', [
    '-c',
    `set -e; cd ${CHECKOUT_PACKAGES_DIR}; for f in *.base64; do base64 -d "$f" > "\${f%.base64}"; rm "$f"; done`,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to decode the checkout packages: ${result.stderr || result.stdout}`);
  }
}

function referencesStartStorybookScript(files: Record<string, string>): boolean {
  return workspacePackageJsonPaths(files).some((filePath) =>
    (files[filePath] ?? '').includes('start-storybook-mcp.mjs')
  );
}

// The sandbox root package.json plus workspace packages.
function workspacePackageJsonPaths(files: Record<string, string>): string[] {
  return Object.keys(files).filter(
    (filePath) =>
      (filePath === 'package.json' || filePath.endsWith('/package.json')) &&
      !filePath.includes('node_modules/')
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
    `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`
  );
  if (!response.ok) {
    throw new Error(
      `Failed to resolve dist-tags for ${packageName}: ${response.status} ${response.statusText}`
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
        'utf8'
      );
    }
  }
}

/**
 * Register the Storybook MCP in whichever config format the agent reads. `url`
 * defaults to the sandbox-local Storybook; pass an absolute URL to point the
 * agent at an externally hosted build instead.
 */
export async function writeStorybookMcpConfig(
  sandbox: Sandbox,
  agent: EvalAgent,
  url: string = STORYBOOK_MCP_URL
): Promise<void> {
  await registerMcpServer(sandbox, agent, STORYBOOK_MCP_SERVER_NAME, { url });
}

export async function writeClaudeMcpConfig(sandbox: Sandbox): Promise<void> {
  await writeStorybookMcpConfig(sandbox, 'claude-code');
}

export async function writeCodexMcpConfig(sandbox: Sandbox): Promise<void> {
  await writeStorybookMcpConfig(sandbox, 'codex');
}

// In code mode (the default for GPT-6 models) Codex shows MCP server
// instructions only once the model searches its tools, which it skips for
// tasks it thinks it can do alone. AGENTS.md is always in its context.
// Eval-only: Storybook writes no AGENTS.md for real Codex users, so remove
// this once SB-2127 fixes it in the product:
// https://linear.app/chromaui/issue/SB-2127
export async function writeCodexAgentsMd(sandbox: Sandbox): Promise<void> {
  // The copies match the checkout's server; the stable server from npm serves other text.
  if (process.env.EVAL_STORYBOOK_LATEST === '1') {
    return;
  }
  const instructions = await fs.readFile(CODEX_AGENTS_MD_SOURCE_PATH, 'utf8');
  await sandbox.writeFiles({
    'AGENTS.md': `# Storybook\n\nThis project has the Storybook MCP server \`${STORYBOOK_MCP_SERVER_NAME}\`. The tools named below are its tools.\n\n${instructions}`,
  });
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

// The sandbox CLAUDE.md stands in for the `<built_in_browser>` block the
// desktop app injects, so the agent knows it has that browser.
export async function writeClaudeInAppBrowserMock(sandbox: Sandbox): Promise<void> {
  let existingClaudeMd = '';
  try {
    existingClaudeMd = `${(await sandbox.readFile(CLAUDE_BROWSER_PROMPT_SANDBOX_PATH)).trimEnd()}\n\n`;
  } catch {}
  await sandbox.writeFiles({
    [CLAUDE_BROWSER_MOCK_SANDBOX_PATH]: await fs.readFile(CLAUDE_BROWSER_MOCK_SOURCE_PATH, 'utf8'),
    [CLAUDE_BROWSER_PROMPT_SANDBOX_PATH]:
      existingClaudeMd + (await fs.readFile(CLAUDE_BROWSER_PROMPT_SOURCE_PATH, 'utf8')),
  });
  await writeClaudeMcpServer(sandbox, CLAUDE_BROWSER_MCP_SERVER_NAME, {
    command: 'node',
    args: [CLAUDE_BROWSER_MOCK_SANDBOX_PATH],
  });
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

/** A remote (`url`) or local stdio (`command`/`args`) MCP server. */
export type McpServerSpec = { url: string } | { command: string; args?: string[] };

const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Register an arbitrary MCP server in whichever config format the agent
 * reads. Unlike writeStorybookMcpConfig this makes no assumption about what
 * the server is — callers pick the name the agent will see.
 */
export async function registerMcpServer(
  sandbox: Sandbox,
  agent: EvalAgent,
  serverName: string,
  spec: McpServerSpec
): Promise<void> {
  // The name lands unquoted in a TOML section header for Codex.
  if (!MCP_SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error(`registerMcpServer: server name must match ${String(MCP_SERVER_NAME_PATTERN)}`);
  }

  if (agent === 'claude-code') {
    await writeClaudeMcpServer(
      sandbox,
      serverName,
      'url' in spec
        ? { type: 'http', url: spec.url }
        : { command: spec.command, args: spec.args ?? [] }
    );
    return;
  }

  const body =
    'url' in spec
      ? `url = ${JSON.stringify(spec.url)}\ndefault_tools_approval_mode = "auto"\nstartup_timeout_sec = 30\ntool_timeout_sec = 120`
      : `command = ${JSON.stringify(spec.command)}\nargs = [${(spec.args ?? [])
          .map((arg) => JSON.stringify(arg))
          .join(', ')}]\ndefault_tools_approval_mode = "auto"`;
  await appendCodexConfig(sandbox, `[mcp_servers.${serverName}]\n${body}\n`);
}

/**
 * Copy one skill directory into the agent's skills root, keeping the
 * directory's own name as the skill name. Relative paths resolve against
 * agent-eval/.
 */
export async function installSkillDir(
  sandbox: Sandbox,
  agent: EvalAgent,
  sourceDir: string
): Promise<void> {
  const skillsRoot =
    agent === 'claude-code'
      ? path.posix.join('.claude', 'skills')
      : path.posix.join('.agents', 'skills');
  const resolvedDir = path.resolve(AGENT_EVAL_ROOT, sourceDir);
  await writePluginSkills(
    sandbox,
    resolvedDir,
    path.posix.join(skillsRoot, path.basename(resolvedDir))
  );
}

async function writePluginSkills(
  sandbox: Sandbox,
  sourceDir: string,
  targetDir: string
): Promise<void> {
  const files: Record<string, string> = {};
  await collectFiles({ sourceDir, targetDir, files });
  await sandbox.writeFiles(files);
}

async function writeClaudeMcpServer(
  sandbox: Sandbox,
  serverName: string,
  serverConfig: Record<string, unknown>
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
      2
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
