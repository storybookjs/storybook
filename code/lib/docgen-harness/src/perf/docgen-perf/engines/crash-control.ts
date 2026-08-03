/**
 * An engine that always fails, used as the perf gate's negative control.
 *
 * A gate that has never failed is not known to work, so the gate runs the suite once with this
 * engine named and requires that run to come back non-zero. If it ever passes, the gate's own
 * failure detection is broken and the job must say so rather than reporting green.
 *
 * It is out of the default engine set, so a normal suite run never touches it.
 */
console.error('crash-control: failing deliberately, this is the gate negative control');
process.exit(1);
