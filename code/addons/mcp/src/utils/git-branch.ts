import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Resolve the current git branch of the repo at `cwd`.
 *
 * Best-effort: returns `undefined` on a detached HEAD, a non-git
 * directory, or any git error — callers treat the branch as simply
 * unknown rather than failing.
 */
export async function currentGitBranch(cwd: string): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
		const branch = stdout.trim();
		return branch && branch !== 'HEAD' ? branch : undefined;
	} catch {
		return undefined;
	}
}
