#!/usr/bin/env bash
# run-agent.sh <main job> <command…>: runs an NX Cloud agent (<command…>, a bounded
# `nx start-agent`) and stops it a minute after the workflow's <main job> ended (main-job-ended.ts). The agent waits
# for its NX Cloud run, also for one that never starts: when the main job fails before
# `start-ci-run`, as on a failed checkout, the agents would idle until their timeout.
#
# A stop here exits 0: the main job already shows how the run ended, and a red agent is noise.
set -u
main_job=$1
shift

"$@" &
agent=$!

# The processes the agent started, by their parent in `ps`.
descendants() {
  local child
  for child in $(ps -ef | awk -v parent="$1" '$3 == parent { print $2 }'); do
    echo "$child"
    descendants "$child"
  done
}

stop() {
  # On Windows, `kill` reaches the MSYS `timeout` only: the native node processes of
  # `yarn nx start-agent` are not in its Windows process tree, and keep the step open until Nx
  # exits by itself. Each of them goes with its own tree.
  if [ -r "/proc/$agent/winpid" ]; then
    local pid
    for pid in "$agent" $(descendants "$agent"); do
      if [ -r "/proc/$pid/winpid" ]; then
        taskkill //F //T //PID "$(cat "/proc/$pid/winpid" 2>/dev/null)" >/dev/null 2>&1
      fi
    done
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
