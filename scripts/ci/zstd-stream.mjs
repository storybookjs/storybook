/**
 * Dependency-free zstd stdin->stdout stream for CI workspace tarballs.
 *
 * Runs on stock `node:zlib` (zstd support since Node 22.15 / 23.8), so it
 * works on every executor image straight from the git checkout - before (and
 * without) any node_modules being installed. Usage:
 *
 *   tar --create <paths> | node scripts/ci/zstd-stream.mjs compress > x.tar.zst
 *   node scripts/ci/zstd-stream.mjs decompress < x.tar.zst | tar --extract
 */
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

const [mode, levelArg] = process.argv.slice(2);

if (typeof zlib.createZstdCompress !== 'function') {
  console.error(
    `zstd is not available in this Node (${process.version}); requires >= 22.15 or >= 23.8`
  );
  process.exit(2);
}

const level = Number(levelArg ?? 3);
// zlib's default 16 KiB output chunks slow decompression down: the 610 MiB NX DTE node_modules
// archive (3.3 GB of tar) decompresses in 5 s instead of 8 s on a CircleCI Docker large machine.
const chunkSize = 1024 * 1024;

const transform =
  mode === 'compress'
    ? zlib.createZstdCompress({
        chunkSize,
        params: {
          [zlib.constants.ZSTD_c_compressionLevel]: level,
          // Long-distance matching helps on multi-GB node_modules payloads
          // with heavy cross-file redundancy.
          [zlib.constants.ZSTD_c_enableLongDistanceMatching]: 1,
        },
      })
    : mode === 'decompress'
      ? zlib.createZstdDecompress({ chunkSize })
      : null;

if (!transform) {
  console.error(`Usage: zstd-stream.mjs <compress|decompress> [level]`);
  process.exit(2);
}

await pipeline(process.stdin, transform, process.stdout);
