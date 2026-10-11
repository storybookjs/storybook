// `probe-image-size` ships a sync, Buffer-only entrypoint (`probe-image-size/sync`)
// that avoids pulling in the package's HTTP client. DefinitelyTyped only declares
// the default (async/HTTP) entrypoint, so declare the sync one here.
declare module 'probe-image-size/sync.js' {
  import type probe from 'probe-image-size';

  function probeSync(data: Buffer): probe.ProbeResult | null;

  export = probeSync;
}
