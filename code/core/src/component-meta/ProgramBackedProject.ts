import { slash } from '../shared/utils/paths.ts';
import type { ProjectFileTracker } from './ProjectFileTracker.ts';
import { filterSourceFilePaths } from './ProjectFileTracker.ts';
import type { ComponentMetaProjectBase, FileChange, ProjectCommandLine } from './types.ts';

/**
 * The slice of a TypeScript `Program` this base reads.
 *
 * Structural, like the rest of this module's contracts: naming `ts.Program` here would tie every
 * renderer to core's copy of the compiler API (see {@link ProjectCommandLine}). `Source` lets a
 * renderer that is backed by a real `ts.Program` carry `ts.SourceFile` through its own subclass
 * without this module ever naming `typescript`; core's own use of `getSourceFile` never looks past
 * truthiness, so it stays correct at the default `unknown`.
 */
export interface ProgramLike<Source = unknown> {
  getSourceFile(fileName: string): Source;
  getSourceFiles(): readonly { fileName: string }[];
}

/** The slice of a TypeScript `LanguageService` this base drives. `ts.LanguageService` satisfies it. */
export interface ProgramProvider<Source = unknown> {
  getProgram(): ProgramLike<Source> | undefined;
  dispose(): void;
}

/**
 * The half of a component-meta project that is the same for every renderer backed by a TypeScript
 * program: answering the manager's membership and lifecycle questions from the current program, and
 * funnelling file events into the shared {@link ProjectFileTracker}.
 *
 * Renderers supply the two things that genuinely differ - how the program is built, and how
 * metadata is extracted from it - by assigning {@link service} and {@link files}. Those are fields
 * rather than constructor parameters because a host usually closes over the tracker, so the service
 * cannot exist before `super()` runs.
 *
 * `dispose` and `onFilesChanged` are overridable: a renderer that schedules background work has to
 * cancel and reschedule it around them.
 */
export abstract class ProgramBackedProject<
  Snapshot,
  Source = unknown,
> implements ComponentMetaProjectBase {
  protected abstract readonly service: ProgramProvider<Source>;
  protected abstract readonly files: ProjectFileTracker<Snapshot>;

  /** Narrowed by renderers to their own parsed command line, which core must not name. */
  abstract getCommandLine(): ProjectCommandLine;

  dispose(): void {
    this.service.dispose();
  }

  ensureFiles(fileNames: string[]): void {
    this.files.ensureFiles(fileNames);
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.service.getProgram()?.getSourceFile(slash(fileName));
  }

  getSourceFilePaths(): string[] {
    const program = this.service.getProgram();
    if (!program) {
      return [];
    }
    return filterSourceFilePaths(program.getSourceFiles().map((sourceFile) => sourceFile.fileName));
  }

  onFilesChanged(changes: FileChange[]): void {
    // Membership is probed against the pre-event program, captured once so the batch cannot
    // rebuild it mid-loop.
    const program = this.service.getProgram();
    this.files.onFilesChanged(changes, (fileName) => !!program?.getSourceFile(fileName));
  }
}
