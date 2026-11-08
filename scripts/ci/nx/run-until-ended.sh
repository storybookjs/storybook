#!/usr/bin/env bash
# run-until-ended.sh <job> <exit code> <message> <command…>: runs <command…> and stops it a minute
# after the workflow's <job> ended (job-ended.ts), with <message> and <exit code>. Each side of an
# NX DTE run waits for the other, also for one that is gone:
# - An agent (a bounded `nx start-agent`) waits for its NX Cloud run, also for one that never
#   starts: when the main job fails before `start-ci-run`, as on a failed checkout, the agents would
#   idle until their timeout. It stops once its main job has ended, with 0: the main job already
#   shows how the run ended, and a red agent is noise.
# - The main job runs no task itself, so once every agent has ended, nothing can run what is left:
#   when CircleCI lost an agent with tasks NX Cloud had handed it, the main job waited for them
#   until its timeout (70 minutes on Windows). It stops then, with 1.
set -u
job=$1
code=$2
message=$3
shift 3

"$@" &
child_pid=$!

# The processes the command started, by their parent in `ps`.
descendants() {
  local child
  for child in $(ps -ef | awk -v parent="$1" '$3 == parent { print $2 }'); do
    echo "$child"
    descendants "$child"
  done
}

stop() {
  # On Windows, `kill` reaches the MSYS `timeout` only: the native node processes of `yarn nx …`
  # are not in its Windows process tree, and keep the step open until Nx exits by itself. Each of
  # them goes with its own tree.
  if [ -r "/proc/$child_pid/winpid" ]; then
    local pid
    for pid in "$child_pid" $(descendants "$child_pid"); do
      if [ -r "/proc/$pid/winpid" ]; then
        taskkill //F //T //PID "$(cat "/proc/$pid/winpid" 2>/dev/null)" >/dev/null 2>&1
      fi
    done
  fi
  kill "$child_pid" 2>/dev/null
}

ticks=0
while kill -0 "$child_pid" 2>/dev/null; do
  sleep 1
  ticks=$((ticks + 1))
  # CircleCI's API every 30 seconds; the command's own end is seen within a second.
  if [ $((ticks % 30)) -eq 0 ] && node scripts/ci/nx/job-ended.ts "$job"; then
    for _ in $(seq 60); do
      kill -0 "$child_pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$child_pid" 2>/dev/null; then
      echo "$message"
      stop
      wait "$child_pid"
      exit "$code"
    fi
    break
  fi
done
wait "$child_pid"
