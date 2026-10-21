// Probe: path separators in file watchers (watchpack 2.x and chokidar 4.x, repo root versions).
//
// watch-story-specifiers.ts keeps node:path because it "hands paths to watchpack, which matches
// native paths". For each watcher we register a directory (and a single file) in native form and,
// on Windows, also in forward-slash form, then create/modify a file and record:
//   - input:    did events fire at all for that registration form?
//   - output:   separator style of event paths, aggregated sets, getTimeInfoEntries/getWatched keys
//   - matching: does an event path `startsWith(givenDir)` (what prefix-matching code would do)?
// On POSIX the native form IS the forward form, so the backslash registration is skipped.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EVENT_TIMEOUT_MS = 6000;
const AGGREGATE_TIMEOUT_MS = 3000;
const SETTLE_MS = 1000;
const WRITE_GAP_MS = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `predicate` until it returns true or the timeout elapses. Never throws. */
async function waitUntil(predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await delay(50);
  }
  return predicate();
}

const SKIPPED = 'skipped-on-posix';
const uniq = (values) => [...new Set(values)];
const styles = (ctx, values) => uniq(values.map((v) => ctx.separatorStyle(v))).sort();
const styleOf = (ctx, values) => {
  const s = styles(ctx, values);
  return s.length === 0 ? 'no-values' : s.length === 1 ? s[0] : s.join('+');
};

function chokidarVersion(ctx) {
  try {
    const entry = ctx.requireFrom().resolve('chokidar');
    return JSON.parse(readFileSync(path.join(path.dirname(entry), 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

export function versions(ctx) {
  return { watchpack: ctx.packageVersion('watchpack'), chokidar: chokidarVersion(ctx) };
}

/** Registration forms to exercise on this platform: [label, toGiven(nativePath)]. */
function forms(ctx) {
  return ctx.isWindows
    ? [
        ['backslash', (p) => p],
        ['forward', (p) => ctx.toForward(p)],
      ]
    : [['forward', (p) => p]];
}

// ---------------------------------------------------------------------------------------------
// watchpack
// ---------------------------------------------------------------------------------------------

async function watchpackDirectory(ctx, Watchpack, form, toGiven) {
  const nativeDir = path.join(ctx.workDir, `wp-dir-${form}`);
  mkdirSync(nativeDir, { recursive: true });
  const givenDir = toGiven(nativeDir);
  const file = path.join(nativeDir, 'created.txt');

  // Fresh options object per instance: watchpack shares a WatcherManager per options object.
  const wp = new Watchpack({ aggregateTimeout: 100, followSymlinks: false });
  const changes = [];
  const removes = [];
  const aggregated = [];
  wp.on('change', (filePath, mtime, explanation) => changes.push({ filePath, mtime, explanation }));
  wp.on('remove', (filePath, explanation) => removes.push({ filePath, explanation }));
  wp.on('aggregated', (c, r) => aggregated.push({ changes: [...c], removals: [...r] }));

  try {
    // Same call shape as watch-story-specifiers.ts (no startTime).
    wp.watch({ files: [], directories: [givenDir] });
    await delay(SETTLE_MS);

    const isOurs = (e) => path.basename(e.filePath) === 'created.txt';
    writeFileSync(file, 'one\n');
    const created = await waitUntil(() => changes.some(isOurs), EVENT_TIMEOUT_MS);
    await delay(WRITE_GAP_MS);
    const before = changes.filter(isOurs).length;
    appendFileSync(file, 'two\n');
    const modified = await waitUntil(
      () => changes.filter(isOurs).length > before,
      EVENT_TIMEOUT_MS
    );
    await waitUntil(() => aggregated.length > 0, AGGREGATE_TIMEOUT_MS);

    const timeInfoKeys = [...wp.getTimeInfoEntries().keys()].filter((k) =>
      ctx.toForward(k).toLowerCase().startsWith(ctx.toForward(nativeDir).toLowerCase())
    );
    return {
      form,
      givenDir,
      nativeDir,
      created,
      modified,
      changes,
      removes,
      aggregated,
      timeInfoKeys,
      timeInfoFileKeys: timeInfoKeys.filter((k) => path.basename(k) === 'created.txt'),
      timeInfoDirKeys: timeInfoKeys.filter((k) => path.basename(k) === path.basename(nativeDir)),
    };
  } finally {
    wp.close();
  }
}

async function watchpackFile(ctx, Watchpack, form, toGiven) {
  const nativeDir = path.join(ctx.workDir, `wp-file-${form}`);
  mkdirSync(nativeDir, { recursive: true });
  const nativeFile = path.join(nativeDir, 'watched.txt');
  writeFileSync(nativeFile, 'zero\n');
  const givenFile = toGiven(nativeFile);
  await delay(WRITE_GAP_MS);

  const wp = new Watchpack({ aggregateTimeout: 100, followSymlinks: false });
  const changes = [];
  const removes = [];
  const aggregated = [];
  wp.on('change', (filePath, mtime, explanation) => changes.push({ filePath, mtime, explanation }));
  wp.on('remove', (filePath, explanation) => removes.push({ filePath, explanation }));
  wp.on('aggregated', (c, r) => aggregated.push({ changes: [...c], removals: [...r] }));

  try {
    wp.watch({ files: [givenFile], directories: [] });
    await delay(SETTLE_MS);
    // A remove for an existing file right after watch() means the registration did not match.
    const removesBeforeWrite = removes.length;
    appendFileSync(nativeFile, 'one\n');
    const modified = await waitUntil(() => changes.length > 0, EVENT_TIMEOUT_MS);
    await waitUntil(() => aggregated.length > 0, AGGREGATE_TIMEOUT_MS);
    return {
      form,
      givenFile,
      nativeFile,
      modified,
      removesBeforeWrite,
      changes,
      removes,
      aggregated,
    };
  } finally {
    wp.close();
  }
}

async function probeWatchpack(ctx, raw) {
  const Watchpack = ctx.requireFrom()('watchpack');
  raw.watchpack = {};

  if (!ctx.isWindows) {
    for (const id of ['watchpack.input.directories.backslash', 'watchpack.input.files.backslash']) {
      ctx.claim({
        id,
        claim: 'watchpack watch() accepts native backslash paths',
        kind: 'input',
        expected: SKIPPED,
        observed: SKIPPED,
      });
    }
  }

  for (const [form, toGiven] of forms(ctx)) {
    // --- directories ---
    let dir;
    try {
      dir = await watchpackDirectory(ctx, Watchpack, form, toGiven);
      raw.watchpack[`directory-${form}`] = dir;
    } catch (error) {
      ctx.claimError({
        id: `watchpack.input.directories.${form}`,
        claim: `watchpack watch({ directories }) fires events for a ${form}-form directory`,
        kind: 'input',
        expected: true,
        error,
      });
    }
    if (dir) {
      ctx.claim({
        id: `watchpack.input.directories.${form}`,
        claim: `watchpack watch({ directories }) fires create and modify events for a ${form}-form directory`,
        kind: 'input',
        expected: { created: true, modified: true },
        observed: { created: dir.created, modified: dir.modified },
        notes: 'raw.watchpack.directory-<form>.changes',
      });
      const changePaths = dir.changes
        .map((e) => e.filePath)
        .filter((p) => path.basename(p) === 'created.txt');
      ctx.claim({
        id: `watchpack.output.change.${form}`,
        claim: `'change' event file paths are native even when the directory was registered in ${form} form`,
        kind: 'output',
        // DirectoryWatcher builds them with path.join(this.path, filename), which normalizes on win32.
        expected: ctx.isWindows ? 'backslash' : 'forward',
        observed: styleOf(ctx, changePaths),
        notes: 'raw.watchpack.directory-<form>.changes[].filePath',
      });
      const aggChanges = dir.aggregated.flatMap((a) => a.changes);
      ctx.claim({
        id: `watchpack.output.aggregated.${form}`,
        claim: `'aggregated' changes set holds native paths (directory registered in ${form} form)`,
        kind: 'output',
        // Source: _onChange adds `item` (the registered directory string, verbatim), not the file.
        expected: { values: [dir.givenDir], style: ctx.separatorStyle(dir.givenDir) },
        observed: { values: uniq(aggChanges), style: styleOf(ctx, aggChanges) },
        notes:
          'prediction from source: aggregated sets echo the registered key as given, not the changed file',
      });
      ctx.claim({
        id: `watchpack.output.timeInfo.file.${form}`,
        claim: `getTimeInfoEntries() file keys are native (directory registered in ${form} form)`,
        kind: 'output',
        expected: ctx.isWindows ? 'backslash' : 'forward',
        observed: styleOf(ctx, dir.timeInfoFileKeys),
        notes: 'raw.watchpack.directory-<form>.timeInfoKeys',
      });
      ctx.claim({
        id: `watchpack.output.timeInfo.dir.${form}`,
        claim: `getTimeInfoEntries() key for the watched directory itself (registered in ${form} form)`,
        kind: 'output',
        // Source: collectTimeInfoEntries uses this.path, i.e. the directory string as given.
        expected: ctx.separatorStyle(dir.givenDir),
        observed: styleOf(ctx, dir.timeInfoDirKeys),
        notes: 'prediction from source: echoes the registered directory string',
      });
      ctx.claim({
        id: `watchpack.matching.startsWith.${form}`,
        claim: `'change' event paths startWith(givenDir) when the directory was registered in ${form} form`,
        kind: 'output',
        expected: !(ctx.isWindows && form === 'forward'),
        observed: changePaths.length
          ? changePaths.every((p) => p.startsWith(dir.givenDir))
          : 'no-events',
        notes: 'raw.watchpack.directory-<form>.givenDir vs changes[].filePath',
      });
    }

    // --- files ---
    let file;
    try {
      file = await watchpackFile(ctx, Watchpack, form, toGiven);
      raw.watchpack[`file-${form}`] = file;
    } catch (error) {
      ctx.claimError({
        id: `watchpack.input.files.${form}`,
        claim: `watchpack watch({ files }) fires a change event for a ${form}-form file`,
        kind: 'input',
        expected: true,
        error,
      });
    }
    if (file) {
      // Source prediction: on win32 the per-file watcher key is lowercase(givenFile) but lookups use
      // lowercase(path.join(dir, name)), so a '/'-form file never matches: no change, and the
      // initial scan reports it as missing (a spurious 'remove').
      const broken = ctx.isWindows && form === 'forward';
      ctx.claim({
        id: `watchpack.input.files.${form}`,
        claim: `watchpack watch({ files }) fires a change event for a ${form}-form file and no spurious remove`,
        kind: 'input',
        expected: { modified: !broken, spuriousRemove: broken },
        observed: { modified: file.modified, spuriousRemove: file.removesBeforeWrite > 0 },
        notes: 'raw.watchpack.file-<form>.changes / .removes',
      });
      const filePaths = file.changes.map((e) => e.filePath);
      ctx.claim({
        id: `watchpack.output.change.files.${form}`,
        claim: `'change' event path for a watched file (registered in ${form} form)`,
        kind: 'output',
        // Source: WatchpackFileWatcher emits the registered file string verbatim.
        expected: broken ? 'no-values' : ctx.separatorStyle(file.givenFile),
        observed: styleOf(ctx, filePaths),
        notes: 'prediction from source: file watches echo the registered string',
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// chokidar
// ---------------------------------------------------------------------------------------------

async function chokidarDirectory(ctx, chokidar, form, toGiven) {
  const nativeDir = path.join(ctx.workDir, `ck-dir-${form}`);
  mkdirSync(nativeDir, { recursive: true });
  writeFileSync(path.join(nativeDir, 'existing.txt'), 'zero\n');
  const givenDir = toGiven(nativeDir);
  const file = path.join(nativeDir, 'created.txt');

  const events = [];
  const watcher = chokidar.watch(givenDir, { ignoreInitial: false });
  let ready = false;
  watcher.on('all', (event, p) => events.push({ event, path: p }));
  watcher.on('ready', () => (ready = true));
  try {
    const isReady = await waitUntil(() => ready, EVENT_TIMEOUT_MS);
    await delay(WRITE_GAP_MS);
    const isCreated = (e) => e.event === 'add' && path.basename(e.path) === 'created.txt';
    const isChanged = (e) => e.event === 'change' && path.basename(e.path) === 'created.txt';
    writeFileSync(file, 'one\n');
    const added = await waitUntil(() => events.some(isCreated), EVENT_TIMEOUT_MS);
    await delay(WRITE_GAP_MS);
    appendFileSync(file, 'two\n');
    const changed = await waitUntil(() => events.some(isChanged), EVENT_TIMEOUT_MS);
    const watched = Object.keys(watcher.getWatched());
    return {
      form,
      givenDir,
      nativeDir,
      ready: isReady,
      added,
      changed,
      events,
      watchedKeys: watched,
    };
  } finally {
    await watcher.close();
  }
}

async function chokidarFile(ctx, chokidar, form, toGiven) {
  const nativeDir = path.join(ctx.workDir, `ck-file-${form}`);
  mkdirSync(nativeDir, { recursive: true });
  const nativeFile = path.join(nativeDir, 'watched.txt');
  writeFileSync(nativeFile, 'zero\n');
  const givenFile = toGiven(nativeFile);

  const events = [];
  const watcher = chokidar.watch(givenFile, { ignoreInitial: false });
  let ready = false;
  watcher.on('all', (event, p) => events.push({ event, path: p }));
  watcher.on('ready', () => (ready = true));
  try {
    const isReady = await waitUntil(() => ready, EVENT_TIMEOUT_MS);
    await delay(WRITE_GAP_MS);
    appendFileSync(nativeFile, 'one\n');
    const changed = await waitUntil(
      () => events.some((e) => e.event === 'change'),
      EVENT_TIMEOUT_MS
    );
    return {
      form,
      givenFile,
      nativeFile,
      ready: isReady,
      changed,
      events,
      watchedKeys: Object.keys(watcher.getWatched()),
    };
  } finally {
    await watcher.close();
  }
}

async function probeChokidar(ctx, raw) {
  const chokidar = await ctx.importFrom('chokidar');
  raw.chokidar = {};
  const native = ctx.isWindows ? 'backslash' : 'forward';

  if (!ctx.isWindows) {
    for (const id of ['chokidar.input.directory.backslash', 'chokidar.input.file.backslash']) {
      ctx.claim({
        id,
        claim: 'chokidar watch() accepts native backslash paths',
        kind: 'input',
        expected: SKIPPED,
        observed: SKIPPED,
      });
    }
  }

  for (const [form, toGiven] of forms(ctx)) {
    let dir;
    try {
      dir = await chokidarDirectory(ctx, chokidar, form, toGiven);
      raw.chokidar[`directory-${form}`] = dir;
    } catch (error) {
      ctx.claimError({
        id: `chokidar.input.directory.${form}`,
        claim: `chokidar watch() fires add/change for a ${form}-form directory`,
        kind: 'input',
        expected: true,
        error,
      });
    }
    if (dir) {
      ctx.claim({
        id: `chokidar.input.directory.${form}`,
        claim: `chokidar watch() becomes ready and fires add/change for a ${form}-form directory`,
        kind: 'input',
        expected: { ready: true, added: true, changed: true },
        observed: { ready: dir.ready, added: dir.added, changed: dir.changed },
        notes: 'raw.chokidar.directory-<form>.events',
      });
      const eventPaths = dir.events.map((e) => e.path);
      ctx.claim({
        id: `chokidar.output.events.${form}`,
        claim: `chokidar event paths (add/addDir/change) are native (directory registered in ${form} form)`,
        kind: 'output',
        // Source: input is unified to '/', _emit() applies path.normalize on Windows.
        expected: native,
        observed: styleOf(ctx, eventPaths),
        notes: 'raw.chokidar.directory-<form>.events[].path',
      });
      ctx.claim({
        id: `chokidar.output.getWatched.${form}`,
        claim: `chokidar getWatched() keys are native (directory registered in ${form} form)`,
        kind: 'output',
        // Source: _getWatchedDir() keys by path.resolve(dir).
        expected: native,
        observed: styleOf(
          ctx,
          dir.watchedKeys.filter((k) => k.includes(path.basename(dir.nativeDir)))
        ),
        notes: 'raw.chokidar.directory-<form>.watchedKeys',
      });
      ctx.claim({
        id: `chokidar.matching.startsWith.${form}`,
        claim: `chokidar event paths startWith(givenDir) when the directory was registered in ${form} form`,
        kind: 'output',
        expected: !(ctx.isWindows && form === 'forward'),
        observed: eventPaths.length
          ? eventPaths.every((p) => p.startsWith(dir.givenDir))
          : 'no-events',
        notes: 'raw.chokidar.directory-<form>.givenDir vs events[].path',
      });
    }

    let file;
    try {
      file = await chokidarFile(ctx, chokidar, form, toGiven);
      raw.chokidar[`file-${form}`] = file;
    } catch (error) {
      ctx.claimError({
        id: `chokidar.input.file.${form}`,
        claim: `chokidar watch() fires change for a ${form}-form file`,
        kind: 'input',
        expected: true,
        error,
      });
    }
    if (file) {
      ctx.claim({
        id: `chokidar.input.file.${form}`,
        claim: `chokidar watch() becomes ready and fires change for a ${form}-form file`,
        kind: 'input',
        expected: { ready: true, changed: true },
        observed: { ready: file.ready, changed: file.changed },
        notes: 'raw.chokidar.file-<form>.events',
      });
      ctx.claim({
        id: `chokidar.output.events.file.${form}`,
        claim: `chokidar event paths for a watched file are native (registered in ${form} form)`,
        kind: 'output',
        expected: native,
        observed: styleOf(
          ctx,
          file.events.map((e) => e.path)
        ),
        notes: 'raw.chokidar.file-<form>.events[].path',
      });
    }
  }
}

export async function run(ctx) {
  const raw = { platform: process.platform, workDir: ctx.workDir };
  try {
    await probeWatchpack(ctx, raw);
  } catch (error) {
    ctx.claimError({
      id: 'watchpack.load',
      claim: 'watchpack probe ran',
      kind: 'input',
      expected: true,
      error,
    });
  }
  try {
    await probeChokidar(ctx, raw);
  } catch (error) {
    ctx.claimError({
      id: 'chokidar.load',
      claim: 'chokidar probe ran',
      kind: 'input',
      expected: true,
      error,
    });
  }
  return raw;
}
