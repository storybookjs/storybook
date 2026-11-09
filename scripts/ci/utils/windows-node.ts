// Node and Yarn on CircleCI's Windows machines, for the per-job Windows jobs (helpers.ts) and the
// NX DTE agents (scripts/ci/nx/agent-environment.ts). Every NX task hashes this file
// (`ci-environment` in nx.json), since the tasks on a Windows agent run with what it installs.
export const installNodeOnWindows = () => ({
  run: {
    name: 'Install Node + Yarn',
    shell: 'powershell.exe',
    command: [
      '$nodeVersion = Get-Content .nvmrc | Select-Object -First 1',
      'nvm install $nodeVersion',
      'nvm use $nodeVersion',
      'corepack enable',
      'corepack prepare yarn@stable --activate',
    ].join('\n'),
  },
});
