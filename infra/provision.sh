#!/bin/bash
# One-shot provisioning: installs everything, sets up shards, wires nginx.
# Run as root inside your Ubuntu chroot.
#
# Each piece is also runnable on its own if something fails partway —
# see setup-shards.sh for just the Postgres provisioning.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

apt update
apt install -y nodejs npm postgresql postgresql-contrib valkey valkey-tools nginx tmux

bash "$SCRIPT_DIR/setup-shards.sh"

cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-enabled/linkshrink.conf
service nginx restart

echo ""
echo "Valkey, 4 Postgres clusters, and nginx are up."
echo "Valkey should already be running (it starts itself on install) — check with:"
echo "  systemctl status valkey-server"
echo ""
echo "Next: cd $(dirname "$SCRIPT_DIR") && cp .env.example .env && npm install && ./infra/start-all.sh"
