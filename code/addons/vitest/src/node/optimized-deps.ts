import type { TestProject, TestSpecification } from 'vitest/node';

import { relative } from 'pathe';

/**
 * The parts of Vite's dependency optimizer we read. Vite does not export a type for it, and these
 * fields are internal, so every access below is guarded.
 */
type DepsOptimizer = {
  metadata?: {
    browserHash?: string;
    discovered?: Record<string, { processing?: Promise<void> }>;
  };
  scanProcessing?: Promise<void>;
  isOptimizedDepUrl?: (url: string) => boolean;
};

/** The parts of a Vite 6+ dev environment we use. */
type BrowserEnvironment = {
  depsOptimizer?: DepsOptimizer;
  transformRequest?: (url: string) => Promise<unknown>;
  moduleGraph?: {
    getModuleByUrl: (url: string) => Promise<{ importedModules: Set<{ url: string }> } | undefined>;
  };
};

type BrowserViteServer = {
  config: { root: string };
  environments?: { client?: BrowserEnvironment };
};

/** How often to wait for the optimizer, when it starts another run before the last one ends. */
const MAX_SETTLE_ROUNDS = 5;

function browserEnvironmentOf(project: TestProject) {
  const vite = project.browser?.vite as BrowserViteServer | undefined;
  const environment = vite?.environments?.client;
  return vite && environment ? { root: vite.config.root, environment } : undefined;
}

/** The URL Vite serves a file at, as Vite's own `server.warmup` computes it. */
function fileToUrl(file: string, root: string) {
  const path = relative(root, file);
  return path.startsWith('../') || path === '..' || /^[a-zA-Z]:/.test(path)
    ? `/@fs/${file.replace(/^\//, '')}`
    : `/${path}`;
}

function pendingOptimization(optimizer: DepsOptimizer | undefined) {
  return [
    optimizer?.scanProcessing,
    ...Object.values(optimizer?.metadata?.discovered ?? {}).map((dep) => dep.processing),
  ].filter((promise): promise is Promise<void> => !!promise);
}

/**
 * Transforms the given modules and everything they import, the way the browser would request them.
 * Transforming a module is what makes Vite find the dependencies it imports. Vite's own
 * `waitForRequestsIdle` cannot be used to wait for this: it only waits for the first crawl after
 * the server starts, and Vitest keeps the server running between runs.
 */
async function crawl(environment: Required<BrowserEnvironment>, urls: string[]) {
  const seen = new Set<string>();
  const visit = async (url: string): Promise<void> => {
    if (seen.has(url) || environment.depsOptimizer.isOptimizedDepUrl?.(url)) {
      return;
    }
    seen.add(url);
    try {
      await environment.transformRequest(url);
    } catch {
      // The browser hits the same error when the test runs, and reports it there.
      return;
    }
    const module = await environment.moduleGraph.getModuleByUrl(url);
    await Promise.all([...(module?.importedModules ?? [])].map((imported) => visit(imported.url)));
  };
  await Promise.all(urls.map(visit));
}

/**
 * Makes Vite pre-bundle every dependency the given test files import, before any test runs.
 *
 * With a warm optimizer cache, Vite does not scan for dependencies when it starts. A dependency
 * that only a new story file reaches is then found while the tests run. Vite pre-bundles it, which
 * can change the chunks of dependencies the browser has already loaded, such as React. The running
 * tests then see two copies of a module, and fail with errors like "Cannot read properties of null
 * (reading 'useContext')" that have nothing to do with the stories.
 *
 * Crawling the imports of the test files first lets Vite find those dependencies while no test
 * runs. An import the crawl cannot see, like `import(variable)`, can still be found late;
 * {@link watchOptimizedDeps} detects that case.
 */
export async function optimizeTestDependencies(specifications: TestSpecification[]) {
  const filesByProject = new Map<TestProject, Set<string>>();
  for (const { project, moduleId } of specifications) {
    const files = filesByProject.get(project) ?? new Set(project.config.setupFiles);
    files.add(moduleId);
    filesByProject.set(project, files);
  }

  await Promise.all(
    [...filesByProject].map(async ([project, files]) => {
      // Vitest 4 creates the browser server on the first run; Vitest 5 creates it with the project.
      await (project as { _initBrowserServer?: () => Promise<void> })._initBrowserServer?.();
      const browser = browserEnvironmentOf(project);
      const environment = browser?.environment;
      if (
        !environment?.depsOptimizer ||
        !environment.transformRequest ||
        !environment.moduleGraph
      ) {
        return;
      }
      await crawl(
        environment as Required<BrowserEnvironment>,
        [...files].map((file) => fileToUrl(file, browser!.root))
      );

      for (let round = 0; round < MAX_SETTLE_ROUNDS; round++) {
        const pending = pendingOptimization(environment.depsOptimizer);
        if (pending.length === 0) {
          return;
        }
        await Promise.all(pending);
      }
    })
  );
}

/**
 * Records the optimizer state of the projects' browser servers, and returns a function that tells
 * whether Vite has since re-bundled dependencies in a way that invalidated what the browser had
 * already loaded. Vite keeps the browser hash when new dependencies leave the existing chunks
 * intact, and changes it when it has to reload the page.
 */
export function watchOptimizedDeps(projects: Iterable<TestProject>) {
  const before = [...new Set(projects)].map((project) => {
    const optimizer = browserEnvironmentOf(project)?.environment.depsOptimizer;
    return { optimizer, browserHash: optimizer?.metadata?.browserHash };
  });
  return () =>
    before.some(
      ({ optimizer, browserHash }) =>
        !!browserHash && optimizer?.metadata?.browserHash !== browserHash
    );
}
