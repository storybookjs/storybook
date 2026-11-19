// Neither sandbox environment ships curl: Vercel Sandboxes run Amazon Linux 2023
// (whose base image has node, tar and gzip but not curl, and `dnf install curl`
// is unavailable to us), and the Docker image used for local, non-Vercel runs
// omits it too. Every download therefore goes through node's own fetch.

// A `node -e` program that streams a URL to a file, exiting non-zero (with the
// reason on stderr) on any HTTP or network error. Invoke as:
//   node -e '<NODE_DOWNLOAD_SCRIPT>' <url> <dest> <timeoutMs>
// Its argv values are read positionally, so it stays safe to embed both as a
// runCommand argument and single-quoted inside a bash script — the script body
// itself contains no single quotes.
export const NODE_DOWNLOAD_SCRIPT = [
  'const { createWriteStream } = require("node:fs");',
  'const { Readable } = require("node:stream");',
  'const { pipeline } = require("node:stream/promises");',
  'const [url, dest, timeoutMs] = process.argv.slice(1);',
  'fetch(url, { signal: AbortSignal.timeout(Number(timeoutMs)) })',
  '  .then(async (response) => {',
  '    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);',
  '    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));',
  '  })',
  '  .catch((error) => {',
  '    console.error(error instanceof Error ? error.message : String(error));',
  '    process.exit(1);',
  '  });',
].join('\n');
