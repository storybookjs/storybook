// Workload registry: the default project of each workload and every workload option.
// bench.mjs passes the options through to run.mjs unchanged.
export const WORKLOADS = {
  'status-flood': { defaultProject: 'synthetic', projects: ['synthetic', 'chromatic'] },
  'browse-search': { defaultProject: 'chromatic', projects: ['synthetic', 'chromatic'] },
  'vitest-run': { defaultProject: 'chromatic', projects: ['chromatic'] },
  docgen: { defaultProject: 'synthetic', projects: ['synthetic', 'chromatic'] },
};

export const workloadOptions = {
  // status-flood
  statuses: { type: 'string', default: '50' },
  'flood-interval': { type: 'string', default: '500' },
  'flood-ticks': { type: 'string', default: '40' },
  'flood-pool': { type: 'string', default: 'all' },
  // status-flood, browse-search
  'index-requests': { type: 'string', default: '20' },
  query: { type: 'string' },
  // browse-search
  arrows: { type: 'string', default: '20' },
  visits: { type: 'string', default: '10' },
  // vitest-run
  'vitest-runs': { type: 'string', default: '1' },
  'vitest-timeout-min': { type: 'string', default: '40' },
  // docgen (SB-2057)
  edits: { type: 'string', default: '50' },
  'edit-interval': { type: 'string', default: '100' },
  singles: { type: 'string', default: '15' },
  docs: { type: 'string', default: '10' },
  'log-snapshot': { type: 'string' },
  // any workload
  'stop-after': { type: 'string' },
  phases: { type: 'string' },
};
