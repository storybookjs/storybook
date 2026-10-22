// The Angular CLI passes an empty string for a bare `--stats-json` flag.
export function normalizeStatsJson(statsJson: string | boolean | undefined) {
  return statsJson === '' ? true : statsJson;
}
