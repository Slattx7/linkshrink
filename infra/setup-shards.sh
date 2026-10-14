#!/bin/bash
# Provisions 2 shards, each a primary + streaming read replica, as separate
# Postgres clusters on one machine. Run as root inside your Ubuntu chroot.
#
# Check your version first with `psql --version` and adjust PG_VERSION below
# if it isn't 16 — Ubuntu 24.04 ships Postgres 16 by default.
set -e

PG_VERSION=16
REPL_USER=replicator
REPL_PASS=changeme_replica_password   # change this before running in anything but a private lab

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

create_primary() {
  local name=$1
  local port=$2

  pg_createcluster $PG_VERSION "$name" -p "$port" -- --auth-local=trust
  pg_conftool $PG_VERSION "$name" set listen_addresses '*'
  pg_conftool $PG_VERSION "$name" set wal_level replica
  pg_conftool $PG_VERSION "$name" set max_wal_senders 4
  pg_conftool $PG_VERSION "$name" set max_replication_slots 4
  pg_conftool $PG_VERSION "$name" set shared_buffers 64MB  # you're running 4 clusters, keep each light

  echo "host replication $REPL_USER 127.0.0.1/32 md5" >> "/etc/postgresql/$PG_VERSION/$name/pg_hba.conf"
  echo "host all all 127.0.0.1/32 md5" >> "/etc/postgresql/$PG_VERSION/$name/pg_hba.conf"

  pg_ctlcluster $PG_VERSION "$name" start
  sudo -u postgres psql -p "$port" -c "CREATE ROLE $REPL_USER WITH REPLICATION LOGIN PASSWORD '$REPL_PASS';"
  sudo -u postgres createdb -p "$port" linkshrink
  sudo -u postgres psql -p "$port" -d linkshrink -f "$SCRIPT_DIR/../schema.sql"
}

create_replica() {
  local name=$1
  local port=$2
  local primary_port=$3

  # Create the cluster normally first so Debian's postgresql-common wrapper
  # (config, service registration) is set up, then wipe the data directory
  # and let pg_basebackup repopulate it as a standby.
  pg_createcluster $PG_VERSION "$name" -p "$port"
  pg_ctlcluster $PG_VERSION "$name" stop
  rm -rf "/var/lib/postgresql/$PG_VERSION/$name"/*

  sudo -u postgres PGPASSWORD=$REPL_PASS pg_basebackup \
    -h 127.0.0.1 -p "$primary_port" -U $REPL_USER \
    -D "/var/lib/postgresql/$PG_VERSION/$name" \
    -R -X stream -C -S "${name}_slot"

  pg_conftool $PG_VERSION "$name" set shared_buffers 64MB
  pg_ctlcluster $PG_VERSION "$name" start
}

create_primary shard0primary 5432
create_primary shard1primary 5434
create_replica shard0replica 5433 5432
create_replica shard1replica 5435 5434

echo ""
echo "Done. Current clusters:"
pg_lsclusters
