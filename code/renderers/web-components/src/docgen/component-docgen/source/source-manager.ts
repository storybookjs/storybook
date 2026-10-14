import { logger } from 'storybook/internal/node-logger';
import type { DocgenError } from 'storybook/internal/types';

import type * as ts from 'typescript';
import { isAbsolute, normalize, relative } from 'pathe';

import type { CemTag } from '../manifest/cem-manager.ts';
import { buildTagIndex } from '../manifest/build-tag-index.ts';
import { flattenInheritance } from '../manifest/flatten-inheritance.ts';
import type { ManifestDeclaration, ManifestPackage } from '../manifest/types.ts';
import type { TagLookup, TagResolver } from '../tag-resolver.ts';
import { errorMessage } from '../utils.ts';
import type { GeneratorAdapter } from './generator.ts';
import { GeneratorManager } from './generator-manager.ts';
import type { GeneratorProject } from './generator-project.ts';

type Probe = () => CemTag | undefined;

interface Miss {
  error: DocgenError;
  revisions: Map<GeneratorProject, number>;
}

export class SourceManager implements TagResolver {
  private manager?: GeneratorManager;
  private readonly rootsByTag = new WeakMap<GeneratorProject, Map<string, string>>();
  private readonly literalMisses = new WeakMap<GeneratorProject, Map<string, number>>();
  /** Keyed by story file, then tag; valid until a searched project sees a file event. */
  private readonly misses = new Map<string, Map<string, Miss>>();
  private readonly warnedAnalysisFailures = new Set<string>();

  constructor(
    private readonly typescript: typeof ts,
    private readonly generator: GeneratorAdapter,
    private readonly previewFilePath?: string
  ) {}

  async find(tag: string, lookup: TagLookup): Promise<CemTag | DocgenError> {
    try {
      const manager = this.getManager();
      const story = normalize(lookup.storyFilePath);
      const preview = this.previewFilePath ? normalize(this.previewFilePath) : undefined;
      const storyProject = manager.getProjectForFile(story);
      const previewProject = preview ? manager.getProjectForFile(preview) : undefined;
      const projects = [...new Set([storyProject, previewProject ?? storyProject])];
      const tried = [story, ...(preview ? [preview] : [])];
      const miss = this.misses.get(story)?.get(tag);
      if (miss && projects.every((project) => miss.revisions.get(project) === project.revision)) {
        return miss.error;
      }

      const probes: Probe[] = [
        () => this.findFromRememberedRoot(tag, storyProject),
        () => this.findFromRoots(tag, [story], storyProject),
        () =>
          preview && previewProject
            ? this.findFromRoots(tag, [preview], previewProject)
            : undefined,
        ...projects.map((project) => () => this.findFromTagLiteral(tag, project, tried)),
      ];
      for (const probe of probes) {
        const found = probe();
        if (found) {
          return found;
        }
      }
      const error = tagNotFound(tag, story, preview, projects);
      const storyMisses = this.misses.get(story) ?? new Map<string, Miss>();
      storyMisses.set(tag, {
        error,
        revisions: new Map(projects.map((project) => [project, project.revision])),
      });
      this.misses.set(story, storyMisses);
      return error;
    } catch (error) {
      const message = `Failed to analyze sources for "${tag}": ${errorMessage(error)}`;
      this.warnOnce(message);
      return { name: 'source-analysis-failed', message };
    }
  }

  dispose(): void {
    this.manager?.dispose();
    this.manager = undefined;
  }

  private getManager(): GeneratorManager {
    if (!this.manager) {
      this.manager = new GeneratorManager(this.typescript, this.generator);
      this.manager.startWatching();
    }
    return this.manager;
  }

  private findFromRememberedRoot(tag: string, project: GeneratorProject): CemTag | undefined {
    const root = this.rootsByTag.get(project)?.get(tag);
    if (!root) {
      return undefined;
    }
    const found = this.findFromRoots(tag, [root], project);
    if (!found) {
      this.rootsByTag.get(project)?.delete(tag);
    }
    return found;
  }

  private findFromTagLiteral(
    tag: string,
    project: GeneratorProject,
    tried: string[]
  ): CemTag | undefined {
    const misses = this.literalMisses.get(project) ?? new Map<string, number>();
    this.literalMisses.set(project, misses);
    if (misses.get(tag) === project.revision) {
      return undefined;
    }
    const pattern = tagLiteralPattern(tag);
    const candidates = project
      .rootFileNames()
      .filter(
        (fileName) =>
          !tried.includes(fileName) && pattern.test(this.typescript.sys.readFile(fileName) ?? '')
      );
    const found = candidates.length > 0 ? this.findFromRoots(tag, candidates, project) : undefined;
    if (!found) {
      misses.set(tag, project.revision);
    }
    return found;
  }

  private findFromRoots(
    tag: string,
    roots: string[],
    project: GeneratorProject
  ): CemTag | undefined {
    const manifest = project.createManifestForRoots(roots);
    const found = manifest ? cemTagFromManifest(tag, manifest) : undefined;
    if (!found) {
      return undefined;
    }
    const projectRoots = this.rootsByTag.get(project) ?? new Map<string, string>();
    projectRoots.set(tag, found.rootPath);
    this.rootsByTag.set(project, projectRoots);
    return { declaration: found.declaration, manifestPath: found.manifestPath };
  }

  private warnOnce(message: string): void {
    if (this.warnedAnalysisFailures.has(message)) {
      return;
    }
    this.warnedAnalysisFailures.add(message);
    logger.warn(message);
  }
}

function cemTagFromManifest(
  tag: string,
  manifest: ManifestPackage
): (CemTag & { rootPath: string }) | undefined {
  const flattened = flattenInheritance(manifest);
  const declaration = buildTagIndex(flattened).get(tag);
  if (!declaration) {
    return undefined;
  }
  const modulePath = declarationModulePath(flattened, declaration);
  const rootPath = definitionModulePath(flattened, tag) ?? modulePath;
  if (!rootPath) {
    return undefined;
  }
  return {
    declaration,
    manifestPath: modulePath ? cwdRelative(modulePath) : '',
    rootPath,
  };
}

function definitionModulePath(manifest: ManifestPackage, tag: string): string | undefined {
  for (const module of manifest.modules) {
    const defines = module.exports?.some(
      (candidate) => candidate.kind === 'custom-element-definition' && candidate.name === tag
    );
    if (defines && typeof module.path === 'string') {
      return normalize(module.path);
    }
  }
  return undefined;
}

function declarationModulePath(
  manifest: ManifestPackage,
  declaration: ManifestDeclaration
): string | undefined {
  for (const module of manifest.modules) {
    if (Array.isArray(module.declarations) && module.declarations.includes(declaration)) {
      return typeof module.path === 'string' ? normalize(module.path) : undefined;
    }
  }
  return undefined;
}

function cwdRelative(path: string): string {
  return isAbsolute(path) ? relative(process.cwd(), path) : normalize(path);
}

function tagLiteralPattern(tag: string): RegExp {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(['"\`])${escaped}\\1`);
}

function tagNotFound(
  tag: string,
  storyFilePath: string,
  previewFilePath: string | undefined,
  projects: GeneratorProject[]
): DocgenError {
  const searched = projects.map((project) =>
    project.configFileName ? cwdRelative(project.configFileName) : 'the inferred TypeScript project'
  );
  const preview = previewFilePath ? ` and preview file ${cwdRelative(previewFilePath)}` : '';
  return {
    name: 'tag-not-found',
    message:
      `No declaration for "${tag}" was found from story file ${cwdRelative(storyFilePath)}${preview}. ` +
      `Searched the tsconfig files covering those files: ${searched.join(', ') || 'none'}. ` +
      'Import the element module in the story or configure customElementsManifest.',
  };
}
