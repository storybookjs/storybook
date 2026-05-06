import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import picocolors from 'picocolors';
import semver from 'semver';

import { getMinorChangelogSummary } from './get-minor-changelog-summary.ts';

const CHANGELOG_PATH = fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url));

const program = new Command();

program
  .name('write-minor-changelog-section')
  .description(
    'Writes a minor/major release section to CHANGELOG.md. Reads the highlights text (tagline + intro + bullet points) from stdin, collects the full entry list automatically, and assembles + writes the complete section.'
  )
  .arguments('[version]')
  .option('--verbose', 'Enable verbose logging', false)
  .option('-d, --dry-run', 'Print the composed section instead of writing to CHANGELOG.md', false);

/** Read all of stdin, or return empty string if stdin is a TTY (interactive). */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks: Array<string> = [];
  for await (const chunk of process.stdin) {
    if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
      chunks.push(chunk.toString());
    }
  }
  return chunks.join('').trim();
}

/**
 * Insert or replace the X.Y.0 section in the changelog content.
 * - If a `## X.Y.0` heading already exists, the entire section is replaced.
 * - Otherwise the new section is prepended to the top of the file.
 */
function insertOrReplaceSection(content: string, version: string, section: string): string {
  const heading = `## ${version}`;

  // Section may be at the very start of the file, or after a newline
  let startIdx: number;
  if (content.startsWith(heading + '\n')) {
    startIdx = 0;
  } else {
    const idx = content.indexOf('\n' + heading + '\n');
    startIdx = idx === -1 ? -1 : idx + 1; // +1 to skip the leading \n
  }

  if (startIdx !== -1) {
    // Find where this section ends (the next `## ` heading)
    const afterHeading = startIdx + heading.length + 1;
    const nextSectionIdx = content.indexOf('\n## ', afterHeading);

    if (nextSectionIdx !== -1) {
      return content.slice(0, startIdx) + section + '\n' + content.slice(nextSectionIdx + 1);
    } else {
      return content.slice(0, startIdx) + section;
    }
  } else {
    // No existing section — prepend to the top
    return section + '\n' + content;
  }
}

function esMain(url: string): boolean {
  if (!url || !process.argv[1]) {
    return false;
  }
  const require = createRequire(url);
  const scriptPath = require.resolve(process.argv[1]);
  const modulePath = fileURLToPath(url);
  const extension = extname(scriptPath);
  return extension
    ? modulePath === scriptPath
    : modulePath.slice(0, -extname(modulePath).length) === scriptPath;
}

if (esMain(import.meta.url)) {
  const opts = program.parse();
  const [version] = opts.args;
  const { verbose, dryRun } = opts.opts();

  const log = (...msg: unknown[]) => {
    if (verbose) {
      console.error(...msg);
    }
  };

  if (version && !semver.valid(version)) {
    console.error(
      `🚨 Invalid argument, expected a semver version e.g. ${picocolors.green('10.4.0')}, got: ${picocolors.red(version)}`
    );
    process.exit(1);
  }

  (async () => {
    // 1. Read highlights from stdin
    const highlights = await readStdin();
    if (!highlights) {
      const invokedScriptPath =
        process.argv[1] ?? '.agents/skills/minor-release/write-minor-changelog-section.ts';
      console.error(
        `🚨 No highlights provided via stdin.\n\nUsage:\n  echo "highlights text" | node ${invokedScriptPath} [version]\n\nThe highlights text should contain the tagline, intro sentence, and bullet points — everything except the ## heading and the full entry list.`
      );
      process.exit(1);
    }

    // 2. Collect the full entry list (also resolves the version if not provided)
    const { text: entries, resolvedVersion } = await getMinorChangelogSummary({
      version,
      verbose,
    });

    log(`\n📝 Composing changelog section for ${picocolors.blue(resolvedVersion)}...`);

    // 3. Assemble the full section
    const section = [
      `## ${resolvedVersion}`,
      '',
      highlights,
      '',
      '<details>',
      '<summary>List of all updates</summary>',
      '',
      entries,
      '',
      '</details>',
      '',
    ].join('\n');

    if (dryRun) {
      console.log(section);
      return;
    }

    // 4. Read CHANGELOG.md, insert/replace the section, write back
    const existing = await readFile(CHANGELOG_PATH, 'utf-8');
    const updated = insertOrReplaceSection(existing, resolvedVersion, section);

    await writeFile(CHANGELOG_PATH, updated, 'utf-8');
    log(`✅ Written to ${picocolors.green(CHANGELOG_PATH)}`);
    console.error(
      `✅ CHANGELOG.md updated for ${picocolors.blue(resolvedVersion)} (${picocolors.yellow(entries.split('\n').length)} entries)`
    );
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
