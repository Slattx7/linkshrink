#!/bin/bash
# Chaos test: stops shard0's primary, lets you watch writes fail, then
# promotes shard0's replica. Run this ON THE PHONE. See README.md in this
# folder for what this does and doesn't prove.
set -e

PG_VERSION=16  # match whatever setup-shards.sh used

echo "Stopping shard0primary (port 5432)..."
pg_ctlcluster $PG_VERSION shard0primary stop

cat <<'EOF'

Now, from another terminal, try creating a link a few times:
  curl -X POST http://localhost:8080/api/shorten \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}'

The ones that hash to shard 0 should fail, the ones that hash to shard 1
should keep working. That's the failure mode of an unreplicated shard
going down — half your writes, not all of them.

EOF
read -p "Press enter once you've confirmed that, to promote shard0replica..."

echo "Promoting shard0replica (port 5433)..."
sudo -u postgres psql -p 5433 -c "SELECT pg_promote();"

cat <<'EOF'

shard0replica is now a writable primary. To actually route traffic to it:
  1. Edit .env: SHARD0_PRIMARY_PORT=5433
  2. Restart the app instances:
       tmux kill-session -t linkshrink-1
       tmux kill-session -t linkshrink-2
       ./infra/start-all.sh

Notice what just happened: promotion was one command, but making the app
use the new primary was a manual edit and a restart. That gap is exactly
what automatic failover tooling (Patroni, pg_auto_failover) exists to close.

EOF
