import { createHash } from 'node:crypto';

import type { PathData } from 'webpack';

// Leave headroom below the common 255-byte filesystem component limit.
const MAX_FILENAME_LENGTH = 200;
const HASH_LENGTH = 16;
const UNSAFE_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f[\]]/g;

const DEVELOPMENT_SUFFIX = '.iframe.bundle.js';
const PRODUCTION_SUFFIX = '.[contenthash:8].iframe.bundle.js';

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

function previewChunkFilename({ chunk }: PathData, suffix: string) {
  const nameOrId = chunk?.name || chunk?.id;
  const name = String(nameOrId === 0 ? 0 : nameOrId || 'chunk');
  if (Buffer.byteLength(name + suffix) <= MAX_FILENAME_LENGTH) {
    return `${name}${suffix}`;
  }

  const sanitizedName = name
    .replace(UNSAFE_FILENAME_CHARACTERS, '-')
    .replace(/[ .]+$/g, (characters) => '-'.repeat(characters.length));
  const hashSuffix = `-${hash(name)}`;
  const maxNameBytes = MAX_FILENAME_LENGTH - Buffer.byteLength(hashSuffix + suffix);
  const prefix = truncateToBytes(sanitizedName, maxNameBytes).replace(/[ .]+$/g, '') || 'chunk';

  return `${prefix}${hashSuffix}${suffix}`;
}

export const developmentPreviewChunkFilename = (pathData: PathData) =>
  previewChunkFilename(pathData, DEVELOPMENT_SUFFIX);

export const productionPreviewChunkFilename = (pathData: PathData) =>
  previewChunkFilename(pathData, PRODUCTION_SUFFIX);
