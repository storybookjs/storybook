#!/usr/bin/env bash
# run-agent.sh <main job> <minutes>: runs an NX Cloud agent (`nx start-agent`) for at most <minutes>,
# and stops it a minute after the workflow's <main job> ended (main-job-ended.ts). The agent waits
# for its NX Cloud run, also for one that never starts: when the main job fails before
# `start-ci-run`, as on a failed checkout, the agents would idle until their timeout.
set -u
main_job=$1
minutes=$2

/usr/bin/timeout --kill-after=1m "${minutes}m" yarn nx start-agent &
agent=$!

checks=0
while kill -0 "$agent" 2>/dev/null; do
  sleep 5
  checks=$((checks + 1))
  # CircleCI's API every 30 seconds; the agent's own end is seen within 5.
  if [ $((checks % 6)) -eq 0 ] && node scripts/ci/nx/main-job-ended.ts "$main_job"; then
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
      kill -0 "$agent" 2>/dev/null || break
      sleep 5
    done
    if kill -0 "$agent" 2>/dev/null; then
      echo "$main_job has ended, so this agent stops."
      kill "$agent"
    fi
    break
  fi
done
wait "$agent"
