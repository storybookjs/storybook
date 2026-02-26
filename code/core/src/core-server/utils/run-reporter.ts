import picocolors from 'picocolors';

/** A log entry captured from browser console during story playback. */
export interface ConsoleLog {
  level: 'log' | 'warn' | 'error';
  text: string;
  timestamp: number;
}

/** Result of running a single story, including status, duration, errors, and console logs. */
export interface StoryResult {
  id: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  stacktrace?: string;
  consoleLogs?: ConsoleLog[];
}

/** Aggregated result of a run, containing summary counts and per-story results. */
export interface RunResult {
  passed: number;
  failed: number;
  skipped: number;
  stories: StoryResult[];
}

/**
 * Interface for reporting events during story playback. Implementations handle formatting and
 * output of run results.
 */
export interface RunReporterInterface {
  onRunStart(storyIds: string[]): void;
  onStoryStart(storyId: string): void;
  onConsoleLog(storyId: string, log: ConsoleLog): void;
  onStoryResult(result: StoryResult): void;
  onRunEnd(result: RunResult): void;
  onKeepOpen(serverUrl: string): void;
}

/**
 * Reporter for story run results. Outputs either human-readable formatted text or JSON depending on
 * options.
 */
export class RunReporter implements RunReporterInterface {
  private options: { json: boolean };
  private storyStartTimes: Map<string, number> = new Map();

  constructor(options: { json: boolean }) {
    this.options = options;
  }

  onRunStart(storyIds: string[]): void {
    if (this.options.json) {
      return;
    }
    process.stdout.write(`storybook run — ${storyIds.length} stories\n`);
  }

  onStoryStart(storyId: string): void {
    this.storyStartTimes.set(storyId, Date.now());
    if (this.options.json) {
      return;
    }
    process.stdout.write(`Running story: ${storyId}\n`);
  }

  onConsoleLog(storyId: string, log: ConsoleLog): void {
    if (this.options.json) {
      return;
    }
    process.stdout.write(`${picocolors.dim(`[browser] [${log.level}] ${log.text}`)}\n`);
  }

  onStoryResult(result: StoryResult): void {
    if (this.options.json) {
      return;
    }

    const duration =
      result.duration ?? Date.now() - (this.storyStartTimes.get(result.id) ?? Date.now());

    if (result.status === 'passed') {
      process.stdout.write(`${picocolors.green('✓')} ${result.id} — passed (${duration}ms)\n`);
    } else if (result.status === 'failed') {
      if (result.error?.includes('timed out')) {
        process.stdout.write(
          `${picocolors.red('✗')} ${result.id} — timed out after ${duration}ms\n`
        );
      } else {
        process.stdout.write(`${picocolors.red('✗')} ${result.id} — failed\n\n`);
        if (result.error) {
          process.stdout.write(`${result.error}\n`);
        }
        if (result.stacktrace) {
          process.stdout.write(`${result.stacktrace}\n`);
        }
      }
    } else if (result.status === 'skipped') {
      process.stdout.write(`${picocolors.dim(`- ${result.id} — skipped`)}\n`);
    }
  }

  onRunEnd(result: RunResult): void {
    if (this.options.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return;
    }

    process.stdout.write(
      `\nResults: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped\n`
    );

    if (result.failed > 0) {
      process.stdout.write(picocolors.red('\nFailed stories:\n'));
      result.stories.forEach((story) => {
        if (story.status === 'failed') {
          process.stdout.write(
            `${picocolors.red(`- ${story.id}`)}: ${story.error ?? 'Unknown error'}\n`
          );
        }
      });
    }
  }

  onKeepOpen(serverUrl: string): void {
    if (this.options.json) {
      return;
    }
    process.stdout.write(`\nServer is still running at ${serverUrl}\nPress Ctrl+C to stop.\n`);
  }
}
