import { createHash } from 'node:crypto';

import type { PathData } from 'webpack';

// Leave headroom below the common 255-byte filesystem component limit.
const MAX_FILENAME_LENGTH = 200;
const HASH_LENGTH = 16;
const UNSAFE_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f[\]]/g;

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, HASH_LENGTH);
}

function truncateToBytes(value: string, maxBytes: number) {
  let result = '';

  for (const character of value) {
    if (Buffer.byteLength(result + character) > maxBytes) {
      break;
    }
    result += character;
  }

  return result;
}

export function createPreviewFilename(isProd: boolean) {
  const suffix = isProd ? '.[contenthash:8].iframe.bundle.js' : '.iframe.bundle.js';

  return ({ chunk }: PathData) => {
    const nameOrId = chunk?.name || chunk?.id;
    const name = String(nameOrId === 0 ? 0 : nameOrId || 'chunk');
    const sanitizedName = name
      .replace(UNSAFE_FILENAME_CHARACTERS, '-')
      .replace(/[ .]+$/g, (characters) => '-'.repeat(characters.length));
    const needsHash =
      sanitizedName !== name || Buffer.byteLength(sanitizedName + suffix) > MAX_FILENAME_LENGTH;

    if (!needsHash) {
      return `${name}${suffix}`;
    }

    const hashSuffix = `-${hash(name)}`;
    const maxNameBytes = MAX_FILENAME_LENGTH - Buffer.byteLength(hashSuffix + suffix);
    const prefix = truncateToBytes(sanitizedName, maxNameBytes).replace(/[ .]+$/g, '') || 'chunk';

    return `${prefix}${hashSuffix}${suffix}`;
  };
}
