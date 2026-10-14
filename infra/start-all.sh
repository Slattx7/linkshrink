#!/bin/bash
# Launches 2 app instances in separate tmux sessions.
# Assumes the 4 Postgres clusters, Valkey, and nginx are already running.
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tmux new-session -d -s linkshrink-1 "cd $PROJECT_DIR && PORT=3000 npm start"
tmux new-session -d -s linkshrink-2 "cd $PROJECT_DIR && PORT=3001 npm start"

echo "Started 2 app instances: linkshrink-1 (port 3000), linkshrink-2 (port 3001)"
echo "Attach with: tmux attach -t linkshrink-1"
