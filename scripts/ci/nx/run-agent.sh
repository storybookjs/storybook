#!/usr/bin/env bash
# run-agent.sh <main job> <command…>: runs an NX Cloud agent (<command…>, a bounded `nx start-agent`)
# and stops it a minute after the workflow's <main job> ended (main-job-ended.ts). The agent waits
# for its NX Cloud run, also for one that never starts: when the main job fails before
# `start-ci-run`, as on a failed checkout, the agents would idle until their timeout.
#
# A stop here exits 0: the main job already shows how the run ended, and a red agent is noise.
set -u
main_job=$1
shift

"$@" &
agent=$!

stop() {
  # On Windows, `kill` reaches the MSYS `timeout`, not the native node processes Nx starts.
  if [ -r "/proc/$agent/winpid" ]; then
    taskkill //F //T //PID "$(cat "/proc/$agent/winpid")" >/dev/null 2>&1
  fi
  kill "$agent" 2>/dev/null
}

ticks=0
while kill -0 "$agent" 2>/dev/null; do
  sleep 1
  ticks=$((ticks + 1))
  # CircleCI's API every 30 seconds; the agent's own end is seen within a second.
  if [ $((ticks % 30)) -eq 0 ] && node scripts/ci/nx/main-job-ended.ts "$main_job"; then
    for _ in $(seq 60); do
      kill -0 "$agent" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$agent" 2>/dev/null; then
      echo "$main_job has ended, so this agent stops."
      stop
      wait "$agent"
      exit 0
    fi
    break
  fi
done
wait "$agent"
