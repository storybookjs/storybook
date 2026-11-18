/**
 * An engine that always fails: the perf gate's negative control.
 *
 * The gate runs the suite once with this engine named and requires a non-zero exit. If that ever
 * passes, the gate's failure detection is broken. Out of the default run, so nothing else hits it.
 */
console.error('crash-control: failing deliberately, this is the gate negative control');
process.exit(1);
