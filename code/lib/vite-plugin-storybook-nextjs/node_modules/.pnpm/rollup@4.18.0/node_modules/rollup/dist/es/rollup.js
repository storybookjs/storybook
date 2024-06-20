/*
  @license
	Rollup.js v4.18.0
	Wed, 22 May 2024 05:03:09 GMT - commit bb6f069ea3623b0297ef3895f2dcb98a2ca5ef58

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
export { version as VERSION, defineConfig, rollup, watch } from './shared/node-entry.js';
import './shared/parseAst.js';
import '../native.js';
import 'node:path';
import 'path';
import 'node:process';
import 'node:perf_hooks';
import 'node:fs/promises';
import 'tty';
