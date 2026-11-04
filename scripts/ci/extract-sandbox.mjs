/**
 * Node-based sandbox archive extractor for the Windows sandbox jobs.
 *
 * The sandbox archives are `tar --format=posix` (pax) + zstd, produced by the
 * Linux create job. On Windows, bsdtar fails to extract them: pax path
 * records are UTF-8, and names outside the system code page (libarchive
 * issues #2278 / #3063) come back as "Archive entry has empty or unreadable
 * filename ... skipping", which fails the step and leaves the sandbox
 * missing. Node's filesystem is UTF-16-native, so extraction here handles
 * every name bsdtar chokes on, and node-tar's win32 mode sanitizes the
 * characters Windows filenames cannot contain.
 *
 * Unlike bsdtar this cannot run before `yarn install`: it imports the `tar`
 * package. Every Windows job runs `yarn install` (via restoreWindows) before
 * unpacking the sandbox, so node_modules is guaranteed to exist here.
 *
 * Usage: node scripts/ci/extract-sandbox.mjs <archive.tar.zst> [cwd]
 */
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { x } from "tar";

const [archive, cwd = process.cwd()] = process.argv.slice(2);

if (typeof zlib.createZstdDecompress !== "function") {
  console.error(
    `zstd is not available in this Node (${process.version}); requires >= 22.15 or >= 23.8`,
  );
  process.exit(2);
}

if (!archive) {
  console.error(`Usage: extract-sandbox.mjs <archive.tar.zst> [cwd]`);
  process.exit(2);
}

try {
  const unpack = x({
    cwd,
    onwarn: (code, message) => console.error(`${code}: ${message}`),
  });
  await pipeline(
    createReadStream(archive),
    zlib.createZstdDecompress(),
    unpack,
  );
} catch (error) {
  console.error(
    `Failed to extract sandbox archive ${archive}: ${error.message}`,
  );
  process.exit(1);
}
