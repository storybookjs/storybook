#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const MAX_WIDTH = 1200;

const usage = 'Usage: node gif.mjs <frames-dir> <out.gif> [--delay ms]';
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { delay: { type: 'string', default: '1000' } },
});
const [framesDir, out] = positionals;
if (!framesDir || !out) {
  console.error(usage);
  process.exit(2);
}

const frameFiles = readdirSync(framesDir)
  .filter((file) => file.toLowerCase().endsWith('.png'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
if (frameFiles.length === 0) {
  console.error(`No PNG frames in ${framesDir}`);
  process.exit(1);
}

const frames = frameFiles.map((file) => PNG.sync.read(readFileSync(join(framesDir, file))));
const scale = Math.min(1, MAX_WIDTH / Math.max(...frames.map((frame) => frame.width)));
const width = Math.round(Math.max(...frames.map((frame) => frame.width)) * scale);
const height = Math.round(Math.max(...frames.map((frame) => frame.height)) * scale);

// Nearest-neighbour onto one white canvas, so frames of different sizes share the GIF's dimensions.
const toCanvas = (frame) => {
  const pixels = new Uint8Array(width * height * 4).fill(255);
  for (let y = 0; y < Math.min(height, Math.floor(frame.height * scale)); y++) {
    for (let x = 0; x < Math.min(width, Math.floor(frame.width * scale)); x++) {
      const source = (Math.floor(y / scale) * frame.width + Math.floor(x / scale)) * 4;
      pixels.set(frame.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return pixels;
};

const gif = GIFEncoder();
for (const frame of frames) {
  const pixels = toCanvas(frame);
  const palette = quantize(pixels, 256);
  gif.writeFrame(applyPalette(pixels, palette), width, height, {
    palette,
    delay: Number(values.delay),
  });
}
gif.finish();
writeFileSync(out, gif.bytes());
console.log(`${out} (${frames.length} frames, ${width}x${height})`);
